plugins {
    id("com.android.application")
}

// Hassoun Watch Face v1.1.2
android {
    namespace = "ca.hassoun.watchface"
    compileSdk = 36

    defaultConfig {
        applicationId = "ca.hassoun.watchface"
        minSdk = 34
        targetSdk = 36
        versionCode = 4
        versionName = "1.1.2"
    }

    buildFeatures {
        buildConfig = false
    }
}
