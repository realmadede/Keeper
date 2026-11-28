package app.keeper.household;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "PdfExporter")
public class PdfExporterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void saveAndSharePdf(PluginCall call) {
        String rawName = call.getString("filename");
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Missing PDF content");
            return;
        }
        String safeName = sanitizeFilename(rawName);

        executor.execute(() -> {
            try {
                byte[] pdfBytes = Base64.decode(base64, Base64.DEFAULT);
                Context context = getContext();

                // 1. Save a permanent copy to Android Downloads (no storage permission needed on API 29+)
                boolean savedToDownloads = saveToDownloads(context, safeName, pdfBytes);

                // 2. Write a shareable copy in app cache for FileProvider -> Android Share sheet
                File exportsDir = new File(context.getCacheDir(), "exports");
                if (!exportsDir.exists()) {
                    exportsDir.mkdirs();
                }
                File shareFile = new File(exportsDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(shareFile)) {
                    fos.write(pdfBytes);
                    fos.flush();
                }

                Uri shareUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    shareFile
                );

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("application/pdf");
                shareIntent.putExtra(Intent.EXTRA_STREAM, shareUri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, safeName);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(shareIntent, "Share or open PDF");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(chooser);

                JSObject result = new JSObject();
                result.put("savedToDownloads", savedToDownloads);
                result.put("filename", safeName);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Could not export PDF: " + e.getMessage());
            }
        });
    }

    private boolean saveToDownloads(Context context, String filename, byte[] bytes) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                ContentResolver resolver = context.getContentResolver();
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) return false;
                    out.write(bytes);
                    out.flush();
                }
                return true;
            }
            File downloadsDir = Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOWNLOADS
            );
            if (downloadsDir != null && (downloadsDir.exists() || downloadsDir.mkdirs())) {
                File outFile = new File(downloadsDir, filename);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(bytes);
                    fos.flush();
                }
                return true;
            }
        } catch (Exception ignored) {
            // Fall through — Share sheet still delivers the PDF cleanly
        }
        return false;
    }

    private String sanitizeFilename(String name) {
        String fallback = "keeper-statement.pdf";
        if (name == null || name.trim().isEmpty()) return fallback;
        String cleaned = name.replaceAll("[^a-zA-Z0-9._-]", "-");
        if (!cleaned.toLowerCase().endsWith(".pdf")) {
            cleaned = cleaned + ".pdf";
        }
        return cleaned;
    }
}
