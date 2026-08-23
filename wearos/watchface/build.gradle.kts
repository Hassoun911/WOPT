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
        versionCode = 2
        versionName = "1.1.0"
    }

    buildFeatures {
        buildConfig = false
    }
}
