package com.campushub.app;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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
     *   3) 都没有才退出。
     * 不这么做的话，从首页进详情后按返回键会直接退出应用（实测踩到）。
     */
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
        // 询问页面栈：getCurrentPages().length > 1 表示还能返回
        webView.evaluateJavascript(
            "(function(){try{if(window.getCurrentPages&&window.getCurrentPages().length>1){return 'back'}" +
                "if(window.__uniConfig&&window.__uniConfig.router){return 'back'}" +
                "return 'exit'}catch(e){return 'exit'}})()",
            value -> {
                if (value != null && value.contains("back")) {
                    webView.evaluateJavascript(
                        "(function(){try{uni.navigateBack({delta:1})}catch(e){" +
                            "try{window.history.back()}catch(_){}}})()",
                        null
                    );
                } else {
                    finish();
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
