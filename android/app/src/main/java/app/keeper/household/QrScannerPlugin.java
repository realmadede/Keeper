package app.keeper.household;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import com.google.mlkit.vision.common.InputImage;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "QrScanner")
public class QrScannerPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * Opens Google's ML Kit Code Scanner with QR-only focus, auto-zoom, and built-in low-light torch.
     * Requires no runtime camera permission prompt on Android.
     */
    @PluginMethod
    public void scanWithCamera(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .enableAutoZoom()
            .build();
        GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(activity, options);
        scanner.startScan()
            .addOnSuccessListener(barcode -> {
                String raw = barcode.getRawValue();
                if (raw == null || raw.trim().isEmpty()) {
                    call.reject("No QR code data found");
                    return;
                }
                JSObject result = new JSObject();
                result.put("value", raw.trim());
                call.resolve(result);
            })
            .addOnCanceledListener(() -> call.reject("CANCELLED"))
            .addOnFailureListener(e -> call.reject(
                e.getMessage() != null ? e.getMessage() : "Camera scanner unavailable"
            ));
    }

    /**
     * Decodes a QR code from a base64-encoded screenshot or photo using on-device Google ML Kit.
     */
    @PluginMethod
    public void scanImage(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Missing image data");
            return;
        }
        executor.execute(() -> {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);

                int sampleSize = 1;
                int maxDim = Math.max(bounds.outWidth, bounds.outHeight);
                while (maxDim / sampleSize > 2200) {
                    sampleSize *= 2;
                }

                BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
                decodeOpts.inSampleSize = sampleSize;
                Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, decodeOpts);
                if (bitmap == null) {
                    call.reject("Could not read image");
                    return;
                }

                BarcodeScannerOptions options = new BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                    .build();
                BarcodeScanner scanner = BarcodeScanning.getClient(options);
                InputImage inputImage = InputImage.fromBitmap(bitmap, 0);

                scanner.process(inputImage)
                    .addOnSuccessListener(barcodes -> {
                        bitmap.recycle();
                        scanner.close();
                        if (barcodes != null) {
                            for (Barcode barcode : barcodes) {
                                String raw = barcode.getRawValue();
                                if (raw != null && !raw.trim().isEmpty()) {
                                    JSObject result = new JSObject();
                                    result.put("value", raw.trim());
                                    call.resolve(result);
                                    return;
                                }
                            }
                        }
                        call.reject("NO_QR_FOUND");
                    })
                    .addOnFailureListener(e -> {
                        bitmap.recycle();
                        scanner.close();
                        call.reject(
                            e.getMessage() != null ? e.getMessage() : "Could not scan image"
                        );
                    });
            } catch (Exception e) {
                call.reject("Could not decode image: " + e.getMessage());
            }
        });
    }
}
