package com.koperasi.sulfindo;

import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity – extends Capacitor's BridgeActivity.
 *
 * <p>Intercepts WebView network errors (server timeout, no connection, DNS failure)
 * and redirects to a bundled {@code offline.html} page stored in APK assets.
 * The offline page polls the server every 5 seconds and auto-reloads when
 * the connection is restored.
 *
 * <p>A {@link JavascriptInterface} ({@code Android.getServerUrl()}) is injected
 * so the offline page can dynamically resolve the correct server URL at runtime.
 */
public class MainActivity extends BridgeActivity {

    /** Server URL as configured in capacitor.config.json. */
    private static final String SERVER_URL = "http://192.168.20.17:3000";

    /** Offline page path loaded from APK assets. */
    private static final String OFFLINE_PAGE_URL = "file:///android_asset/public/offline.html";

    /**
     * JavaScript interface injected into the WebView.
     * Allows {@code offline.html} to call {@code window.Android.getServerUrl()}.
     */
    public class AndroidBridge {
        /**
         * Returns the configured server URL to the JavaScript context.
         *
         * @return server base URL string
         */
        @JavascriptInterface
        public String getServerUrl() {
            return SERVER_URL;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupOfflineInterceptor();
    }

    /**
     * Injects a custom {@link WebViewClient} that intercepts HTTP error responses
     * and network failures, then loads the bundled offline page.
     *
     * <p>Error codes that trigger the offline page:
     * <ul>
     *   <li>{@link WebViewClient#ERROR_HOST_LOOKUP} – DNS failure</li>
     *   <li>{@link WebViewClient#ERROR_CONNECT} – connection refused</li>
     *   <li>{@link WebViewClient#ERROR_TIMEOUT} – connection timed out</li>
     *   <li>{@link WebViewClient#ERROR_FAILED_SSL_HANDSHAKE}</li>
     *   <li>{@link WebViewClient#ERROR_NOT_CONNECTED} – no active network</li>
     *   <li>Any other generic {@link WebViewClient#ERROR_UNKNOWN} code</li>
     * </ul>
     */
    private void setupOfflineInterceptor() {
        WebView webView = getBridge().getWebView();

        // Inject Android ↔ JS bridge for server URL resolution
        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {

            /**
             * Intercepts main-frame network errors and shows the offline page.
             *
             * @param view        the WebView that encountered the error
             * @param request     the failed request (may be sub-resource for API >= 23)
             * @param error       details of the error
             */
            @Override
            public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
            ) {
                // Only intercept main-frame navigation errors (not sub-resource errors)
                if (request != null && !request.isForMainFrame()) {
                    return;
                }

                int errorCode = error.getErrorCode();

                // Errors that indicate server is unreachable
                boolean isConnectionError =
                    errorCode == WebViewClient.ERROR_HOST_LOOKUP          ||
                    errorCode == WebViewClient.ERROR_CONNECT              ||
                    errorCode == WebViewClient.ERROR_TIMEOUT              ||
                    errorCode == WebViewClient.ERROR_FAILED_SSL_HANDSHAKE ||
                    errorCode == WebViewClient.ERROR_IO                   ||
                    errorCode == WebViewClient.ERROR_UNKNOWN;

                if (isConnectionError) {
                    loadOfflinePage(view);
                }
            }

            /**
             * Intercepts HTTP error responses (4xx / 5xx) from the server.
             * 5xx errors indicate server-side problems; we still show offline page
             * if the server is completely unreachable (handled above).
             *
             * @param view        the WebView
             * @param request     the request that received an HTTP error
             * @param errorResponse the HTTP error response
             */
            @Override
            public void onReceivedHttpError(
                WebView view,
                WebResourceRequest request,
                android.webkit.WebResourceResponse errorResponse
            ) {
                // Let the app handle HTTP errors naturally (404, 500, etc.)
                // Only intercept main-frame 5xx that mean server is down
                if (request != null && request.isForMainFrame()
                    && errorResponse != null
                    && errorResponse.getStatusCode() >= 500) {
                    loadOfflinePage(view);
                }
            }
        });
    }

    /**
     * Loads the bundled offline page from APK assets.
     * Must be called on the UI thread; uses {@link WebView#post} for safety.
     *
     * @param view the WebView to navigate
     */
    private void loadOfflinePage(WebView view) {
        view.post(() -> view.loadUrl(OFFLINE_PAGE_URL));
    }
}
