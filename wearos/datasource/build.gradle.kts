plugins {
    id("com.android.application")
}

val generatedPrayerAssetsDir = file("$buildDir/generated/prayer-assets")
val copyPrayerTimes = tasks.register<Copy>("copyPrayerTimes") {
    from(rootProject.projectDir.resolve("../windsor_islamic_association_2026_prayer_times.json"))
    into(generatedPrayerAssetsDir)
}

android {
    namespace = "ca.hassoun.wear.data"
    compileSdk = 36

    defaultConfig {
        applicationId = "ca.hassoun.wear.data"
        minSdk = 34
        targetSdk = 36
        versionCode = 5
        versionName = "1.1.0"
    }

    sourceSets.getByName("main").assets.srcDir(generatedPrayerAssetsDir)

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

tasks.named("preBuild").configure {
    dependsOn(copyPrayerTimes)
}

dependencies {
    implementation("androidx.wear.watchface:watchface-complications-data-source-ktx:1.2.1")
    implementation("androidx.health:health-services-client:1.1.0-rc02")
    implementation("com.google.guava:listenablefuture:1.0")
}
