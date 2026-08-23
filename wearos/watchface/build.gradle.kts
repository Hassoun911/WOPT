plugins {
    id("com.android.application")
}

// Hassoun Watch Face v1.1.3 — larger text, live steps/battery progress arcs, and Qibla icon button.
android {
    namespace = "ca.hassoun.watchface"
    compileSdk = 36

    defaultConfig {
        applicationId = "ca.hassoun.watchface2"
        minSdk = 34
        targetSdk = 36
        versionCode = 5
        versionName = "1.1.3"
    }

    buildFeatures {
        buildConfig = false
    }
}
