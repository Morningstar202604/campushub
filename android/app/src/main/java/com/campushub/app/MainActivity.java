package com.campushub.app;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

/**
 * CampusHub Android 壳（对应 out/plan.md 的 S04-S10）。
 *
 * 加载包内 assets/www 下的 uni-app H5 产物（file:///android_asset/www/index.html）。
 */
public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    /**
     * 返回键：
     *   1) 先看 WebView 自身历史（真页面跳转时有效）；
     *   2) 再看 uni-app 的 hash 路由栈 —— hash 变化不会让 canGoBack() 变 true，
     *      所以要问页面：uni 的页面栈是否还有上一页；
     *   3) 已在根页面则「再按一次退出」，避免误触直接杀掉应用。
     *
     * 注意：不能再判断 window.__uniConfig.router —— 它在所有页面都恒为真，
     * 会让根页面也走「返回」分支，而 navigateBack 在根页面静默失败，
     * 表现为返回键完全没反应、用户退不出应用（实测踩到）。
     */
    private long lastBackAt = 0L;

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        webView.evaluateJavascript(
            "(function(){try{if(window.getCurrentPages&&window.getCurrentPages().length>1){return 'back'}" +
                "return 'exit'}catch(e){return 'exit'}})()",
            value -> {
                if (value != null && value.contains("back")) {
                    webView.evaluateJavascript(
                        "(function(){try{uni.navigateBack({delta:1})}catch(e){" +
                            "try{window.history.back()}catch(_){}}})()",
                        null
                    );
                } else {
                    long now = System.currentTimeMillis();
                    if (now - lastBackAt < 2000L) {
                        finish();
                    } else {
                        lastBackAt = now;
                        Toast.makeText(this, "再按一次退出应用", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        );
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
