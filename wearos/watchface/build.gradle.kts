plugins {
    id("com.android.application")
}

android {
    namespace = "ca.hassoun.watchface"
    compileSdk = 36

    defaultConfig {
        applicationId = "ca.hassoun.watchface"
        minSdk = 34
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        buildConfig = false
    }
}
