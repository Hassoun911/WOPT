plugins {
    id("com.android.application")
}

// Hassoun Watch Face v1.1.3 — final sideload package identity. Build/download releases from main only so future updates keep the same signing lineage.
android {
    namespace = "ca.hassoun.watchface"
    compileSdk = 36

    defaultConfig {
        applicationId = "ca.hassoun.watchface3"
        minSdk = 34
        targetSdk = 36
        versionCode = 1
        versionName = "1.1.3"
    }

    buildFeatures {
        buildConfig = false
    }
}
