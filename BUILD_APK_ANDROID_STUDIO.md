# Build APK with Android Studio - Step by Step Guide

## Prerequisites

### 1. Install Android Studio
- Download from: https://developer.android.com/studio
- Install with default settings
- During setup, make sure to install:
  - Android SDK
  - Android SDK Platform
  - Android Virtual Device (optional, for testing)

### 2. Install Node.js (if not already installed)
- Download from: https://nodejs.org (use LTS version 18 or 20)
- Verify installation: `node --version`

### 3. Download Your Project
- In Manus UI, go to Code panel → Click "Download All Files"
- Extract the ZIP to a folder (e.g., `C:\Projects\timestamp-tracker`)

---

## Step 1: Prepare the Project

Open terminal/command prompt in your project folder:

```bash
cd C:\Projects\timestamp-tracker
```

Install dependencies:
```bash
npm install -g pnpm
pnpm install
```

---

## Step 2: Generate Native Android Code

Run this command to create the native Android project:

```bash
npx expo prebuild --platform android
```

**What this does:**
- Creates `android/` folder with native Android code
- Configures gradle build files
- Sets up app icons, splash screen, permissions

**If it asks questions:**
- "What is your Android package name?" → Press Enter (uses default from app.config.ts)
- "Overwrite existing files?" → Type `y` and press Enter

---

## Step 3: Open Project in Android Studio

1. Launch Android Studio
2. Click **"Open an Existing Project"**
3. Navigate to your project folder
4. Select the **`android`** folder (NOT the root folder)
5. Click **"OK"**

**Wait for indexing to complete** (bottom right corner shows progress)

---

## Step 4: Configure Signing (Required for APK)

### Create Keystore (First Time Only)

In Android Studio, go to:
1. **Build** → **Generate Signed Bundle / APK**
2. Select **APK** → Click **Next**
3. Click **"Create new..."** under Key store path

**Fill in the form:**
- **Key store path:** Choose a location (e.g., `C:\keystore\timestamp-tracker.jks`)
- **Password:** Create a strong password (SAVE THIS!)
- **Alias:** `timestamp-tracker-key`
- **Alias Password:** Same as keystore password (or different, SAVE THIS!)
- **Validity:** 25 years
- **Certificate:**
  - First and Last Name: Your name
  - Organizational Unit: Your company
  - Organization: Your company
  - City: Your city
  - State: Your state
  - Country Code: Your country (e.g., US, UK, IN)

Click **"OK"** → Click **"Next"**

**IMPORTANT: Save your keystore file and passwords! You'll need them for future updates.**

---

## Step 5: Build the APK

### Option A: Using Android Studio UI

1. **Build** → **Generate Signed Bundle / APK**
2. Select **APK** → Click **Next**
3. Select your keystore file (created in Step 4)
4. Enter passwords
5. Click **Next**
6. Select **release** build variant
7. Check **V1 (Jar Signature)** and **V2 (Full APK Signature)**
8. Click **Finish**

**Build time:** 5-15 minutes (first build is slower)

**Output location:**
```
android/app/release/app-release.apk
```

### Option B: Using Command Line

If you prefer terminal:

```bash
cd android
./gradlew assembleRelease
```

**Output location:**
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## Step 6: Test the APK

### Install on Physical Device

1. Enable **Developer Options** on your Android phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back → Developer Options → Enable "USB Debugging"

2. Connect phone to computer via USB

3. In terminal:
```bash
adb install android/app/release/app-release.apk
```

Or simply copy the APK to your phone and tap it to install.

### Install on Emulator

1. In Android Studio: **Tools** → **Device Manager**
2. Create a new virtual device (if none exists)
3. Start the emulator
4. Drag and drop the APK onto the emulator window

---

## Troubleshooting

### Error: "SDK location not found"

Create a file `android/local.properties`:
```
sdk.dir=C:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
```
(Replace with your actual SDK path)

### Error: "Gradle build failed"

1. In Android Studio: **File** → **Invalidate Caches** → Restart
2. Delete `android/.gradle` and `android/app/build` folders
3. Try building again

### Error: "Execution failed for task ':app:mergeReleaseResources'"

Run:
```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

### Error: "AAPT: error: resource android:attr/lStar not found"

Update `android/build.gradle`:
```gradle
buildscript {
    ext {
        compileSdkVersion = 34
        targetSdkVersion = 34
    }
}
```

---

## File Sizes & Performance

**Expected APK size:** 40-80 MB (first build)

**Reduce APK size (optional):**

Edit `android/app/build.gradle`:
```gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

This can reduce APK size by 30-50%.

---

## Next Steps After Building

### 1. Test Thoroughly
- Install on multiple devices
- Test all features (camera, location, sync)
- Verify Railway sync is working

### 2. Prepare for Google Play Store

**Requirements:**
- App Bundle (AAB) instead of APK
- Privacy Policy URL
- App screenshots
- Feature graphic
- App description

**To build AAB:**
```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 3. Version Management

When you need to release updates:

Edit `app.config.ts`:
```typescript
version: "1.0.1",  // Increment this
```

Edit `android/app/build.gradle`:
```gradle
versionCode 2      // Increment this (was 1)
versionName "1.0.1"
```

Then rebuild the APK.

---

## Important Notes

### Keystore Security
- **NEVER lose your keystore file or passwords**
- If lost, you cannot update your app on Google Play
- Back up to secure cloud storage (encrypted)

### App Signing
- For Google Play, you can use "Play App Signing"
- Google manages your signing key
- More secure and allows key recovery

### Permissions
Your app requires these permissions (already configured):
- Camera
- Location (Fine & Coarse)
- Internet
- Write External Storage

---

## Quick Reference Commands

```bash
# Install dependencies
pnpm install

# Generate native code
npx expo prebuild --platform android

# Clean build
cd android && ./gradlew clean

# Build release APK
cd android && ./gradlew assembleRelease

# Build release AAB (for Play Store)
cd android && ./gradlew bundleRelease

# Install on connected device
adb install android/app/release/app-release.apk

# Check connected devices
adb devices
```

---

## Support

If you encounter issues:
1. Check Android Studio's "Build" panel for detailed error messages
2. Google the specific error message
3. Check Stack Overflow for solutions
4. Consult the Expo documentation: https://docs.expo.dev/workflow/prebuild/

---

**Good luck with your build! 🚀**
