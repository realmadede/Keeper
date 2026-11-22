package app.keeper.household;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String APK_FILENAME = "keeper-update.apk";
    private static final int MAX_REDIRECTS = 6;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasInstallPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void installCachedApk(PluginCall call) {
        File apkFile = new File(getContext().getCacheDir(), APK_FILENAME);
        if (!apkFile.exists() || apkFile.length() == 0) {
            call.reject("No downloaded update file found.");
            return;
        }
        if (!hasInstallPermission()) {
            JSObject result = new JSObject();
            result.put("status", "needs_permission");
            call.resolve(result);
            return;
        }
        try {
            launchInstaller(apkFile);
            JSObject result = new JSObject();
            result.put("status", "installing");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not launch installer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        if (downloadUrl == null || !downloadUrl.startsWith("https://")) {
            call.reject("A valid HTTPS update URL is required.");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection conn = null;
            File partFile = new File(getContext().getCacheDir(), APK_FILENAME + ".part");
            File apkFile = new File(getContext().getCacheDir(), APK_FILENAME);

            try {
                conn = openFollowingRedirects(downloadUrl);
                int statusCode = conn.getResponseCode();
                if (statusCode < 200 || statusCode >= 300) {
                    call.reject("Download failed with HTTP " + statusCode);
                    return;
                }

                long totalBytes = conn.getContentLengthLong();
                if (partFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    partFile.delete();
                }

                try (
                    InputStream input = new BufferedInputStream(conn.getInputStream());
                    FileOutputStream output = new FileOutputStream(partFile)
                ) {
                    byte[] buffer = new byte[16384];
                    long downloaded = 0;
                    int lastEmittedPercent = -1;
                    long lastEmitTime = 0;
                    int bytesRead;

                    while ((bytesRead = input.read(buffer)) != -1) {
                        output.write(buffer, 0, bytesRead);
                        downloaded += bytesRead;

                        int percent = totalBytes > 0
                            ? (int) Math.min(100, (downloaded * 100L) / totalBytes)
                            : 0;
                        long now = System.currentTimeMillis();
                        if (percent >= lastEmittedPercent + 2 || percent == 100 || now - lastEmitTime >= 180) {
                            lastEmittedPercent = percent;
                            lastEmitTime = now;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("downloadedBytes", downloaded);
                            progress.put("totalBytes", Math.max(totalBytes, 0));
                            notifyListeners("downloadProgress", progress);
                        }
                    }
                    output.flush();
                }

                if (apkFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    apkFile.delete();
                }
                if (!partFile.renameTo(apkFile)) {
                    call.reject("Could not finalize downloaded update file.");
                    return;
                }

                JSObject doneProgress = new JSObject();
                doneProgress.put("percent", 100);
                doneProgress.put("downloadedBytes", apkFile.length());
                doneProgress.put("totalBytes", apkFile.length());
                notifyListeners("downloadProgress", doneProgress);

                if (!hasInstallPermission()) {
                    JSObject result = new JSObject();
                    result.put("status", "needs_permission");
                    call.resolve(result);
                    return;
                }

                launchInstaller(apkFile);
                JSObject result = new JSObject();
                result.put("status", "installing");
                call.resolve(result);
            } catch (Exception e) {
                if (partFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    partFile.delete();
                }
                call.reject("Update download failed: " + e.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    private boolean hasInstallPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    private void launchInstaller(File apkFile) {
        Context ctx = getContext();
        Uri apkUri = FileProvider.getUriForFile(
            ctx,
            ctx.getPackageName() + ".fileprovider",
            apkFile
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(intent);
    }

    private HttpURLConnection openFollowingRedirects(String initialUrl) throws Exception {
        String currentUrl = initialUrl;
        for (int hops = 0; hops < MAX_REDIRECTS; hops++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(currentUrl).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "Keeper-Android-Updater");
            conn.connect();

            int code = conn.getResponseCode();
            if (code == HttpURLConnection.HTTP_MOVED_PERM
                || code == HttpURLConnection.HTTP_MOVED_TEMP
                || code == HttpURLConnection.HTTP_SEE_OTHER
                || code == 307
                || code == 308) {
                String next = conn.getHeaderField("Location");
                conn.disconnect();
                if (next == null || !next.startsWith("https://")) {
                    throw new IllegalStateException("Invalid redirect URL during update download.");
                }
                currentUrl = next;
            } else {
                return conn;
            }
        }
        throw new IllegalStateException("Too many redirects while downloading update.");
    }
}
