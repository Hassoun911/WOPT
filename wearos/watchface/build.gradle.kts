plugins {
    id("com.android.application")
}

// Hassoun Watch Face v1.1.1
android {
    namespace = "ca.hassoun.watchface"
    compileSdk = 36

    defaultConfig {
        applicationId = "ca.hassoun.watchface"
        minSdk = 34
        targetSdk = 36
        versionCode = 3
        versionName = "1.1.1"
    }

    buildFeatures {
        buildConfig = false
    }
}
