plugins {
    id("com.android.application")
}

android {
    namespace = "ca.hassoun.wear.data"
    compileSdk = 36

    defaultConfig {
        applicationId = "ca.hassoun.wear.data"
        minSdk = 34
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.wear.watchface:watchface-complications-data-source-ktx:1.2.1")
    implementation("androidx.health:health-services-client:1.1.0-rc02")
    implementation("com.google.guava:listenablefuture:1.0")
}
