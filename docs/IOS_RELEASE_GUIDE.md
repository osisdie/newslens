# iOS App Release Guide

This guide covers the complete process of preparing, testing, and releasing your AI News Aggregator iOS app to the App Store, including TestFlight beta testing.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Release Checklist](#pre-release-checklist)
3. [Apple Developer Account Setup](#apple-developer-account-setup)
4. [App Configuration](#app-configuration)
5. [Building for TestFlight](#building-for-testflight)
6. [TestFlight Beta Testing](#testflight-beta-testing)
7. [App Store Submission](#app-store-submission)
8. [Post-Release](#post-release)

---

## Prerequisites

### Required Accounts & Tools

1. **Apple Developer Account** ($99/year)
   - Sign up at [developer.apple.com](https://developer.apple.com)
   - Enroll in the Apple Developer Program
   - Wait for approval (usually 24-48 hours)

2. **Xcode** (Latest version)
   - Download from Mac App Store
   - Install Command Line Tools: `xcode-select --install`
   - Accept license: `sudo xcodebuild -license accept`

3. **Expo CLI** (if not already installed)
   ```bash
   npm install -g expo-cli eas-cli
   ```

4. **EAS Build Account** (Free tier available)
   - Sign up at [expo.dev](https://expo.dev)
   - Link your Apple Developer account

### System Requirements

- macOS (required for iOS builds)
- Node.js 20+ (already configured in your project)
- Git configured with your credentials

---

## Pre-Release Checklist

Before starting the release process, ensure:

- [ ] App is fully functional and tested locally
- [ ] All features work correctly
- [ ] No console errors or warnings
- [ ] App icons and splash screens are prepared (1024x1024px)
- [ ] Privacy policy URL is ready (required for App Store)
- [ ] Support email address is configured
- [ ] App Store screenshots prepared (various iPhone sizes)
- [ ] App description and keywords prepared
- [ ] Backend API is production-ready and deployed
- [ ] Stripe webhooks are configured for production
- [ ] Environment variables are set for production builds

---

## Apple Developer Account Setup

### 1. Create App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (Add)
4. Select **App IDs** → **Continue**
5. Select **App** → **Continue**
6. Fill in:
   - **Description**: AI News Aggregator
   - **Bundle ID**: `com.ainews.aggregator` (must match `app.json`)
   - **Capabilities**: Enable any required (Push Notifications, In-App Purchase if needed)
7. Click **Continue** → **Register**

### 2. Create Distribution Certificate

1. In **Certificates**, click **+** (Add)
2. Select **Apple Distribution** → **Continue**
3. Follow instructions to create Certificate Signing Request (CSR):
   ```bash
   # On macOS, open Keychain Access
   # Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
   # Enter your email and name, save to disk
   ```
4. Upload the CSR file
5. Download the certificate and double-click to install in Keychain

### 3. Create App Store Connect App

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** (New App)
3. Fill in:
   - **Platform**: iOS
   - **Name**: AI News Aggregator
   - **Primary Language**: English (or your primary language)
   - **Bundle ID**: Select `com.ainews.aggregator`
   - **SKU**: `ai-news-aggregator-001` (unique identifier)
   - **User Access**: Full Access
4. Click **Create**

---

## App Configuration

### 1. Update `app.json`

Ensure your `mobile/app.json` has the following configuration:

```json
{
  "expo": {
    "name": "AI News Aggregator",
    "slug": "ai-news-aggregator",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.ainews.aggregator",
      "buildNumber": "1",
      "infoPlist": {
        "NSUserTrackingUsageDescription": "We use tracking to improve your news experience.",
        "NSPhotoLibraryUsageDescription": "We need access to your photo library to save images."
      }
    },
    "extra": {
      "eas": {
        "projectId": "your-project-id-here"
      }
    }
  }
}
```

**Important Notes:**
- `bundleIdentifier` must match the App ID created in Apple Developer Portal
- `version` follows semantic versioning (e.g., "1.0.0")
- `buildNumber` must increment for each build (e.g., "1", "2", "3")
- Add `NSUserTrackingUsageDescription` if using analytics
- Add other usage descriptions as needed

### 2. Create `eas.json` Configuration

Create `mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "bundleIdentifier": "com.ainews.aggregator"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "your-team-id"
      }
    }
  }
}
```

**To find your Team ID:**
1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Click **Membership** → Your Team ID is displayed

**To find your App Store Connect App ID:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app → The App ID is in the URL or under **App Information**

### 3. Configure Environment Variables

Create `mobile/.env.production`:

```bash
EXPO_PUBLIC_API_URL=https://your-production-api.com/api
```

Update `mobile/src/services/api.js` to use production URL in production builds.

### 4. Prepare App Assets

Ensure you have:

- **App Icon**: 1024x1024px PNG (no transparency)
  - Location: `mobile/assets/icon.png`
- **Splash Screen**: 1242x2436px PNG
  - Location: `mobile/assets/splash.png`
- **App Store Screenshots** (required sizes):
  - iPhone 6.7" (1290 x 2796): iPhone 14 Pro Max, 15 Pro Max
  - iPhone 6.5" (1284 x 2778): iPhone 11 Pro Max, XS Max
  - iPhone 5.5" (1242 x 2208): iPhone 8 Plus
  - iPad Pro 12.9" (2048 x 2732)
  - iPad Pro 11" (1668 x 2388)

---

## Building for TestFlight

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Login to Expo

```bash
cd mobile
eas login
```

### 3. Configure EAS Build

```bash
eas build:configure
```

This will:
- Create `eas.json` if it doesn't exist
- Link your project to Expo
- Set up build configuration

### 4. Link Apple Developer Account

```bash
eas credentials
```

Follow prompts to:
- Select iOS platform
- Link your Apple Developer account
- EAS will automatically manage certificates and provisioning profiles

### 5. Build for TestFlight

#### Option A: Build Locally (Requires macOS)

```bash
eas build --platform ios --profile production --local
```

#### Option B: Build on EAS Servers (Recommended)

```bash
eas build --platform ios --profile production
```

**Build Process:**
- EAS will upload your code
- Build on Apple's infrastructure
- Generate `.ipa` file
- Upload to App Store Connect automatically

**Build Time:** ~15-30 minutes

### 6. Monitor Build Status

```bash
eas build:list
```

Or check at [expo.dev](https://expo.dev/accounts/[your-account]/projects/[your-project]/builds)

---

## TestFlight Beta Testing

### 1. Wait for Processing

After build completes:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **AI News Aggregator** → **TestFlight**
3. Wait for processing (usually 5-15 minutes)
4. Status will change from "Processing" to "Ready to Submit"

### 2. Add Test Information

1. In TestFlight, click **Test Information**
2. Fill in:
   - **What to Test**: Brief description of what testers should focus on
   - **Feedback Email**: Your support email
   - **Marketing URL**: Your website (optional)
   - **Privacy Policy URL**: **Required** - Your privacy policy URL

### 3. Add Internal Testers

**Internal Testers** (up to 100, immediate access):
1. Go to **Internal Testing** tab
2. Click **+** to create group (e.g., "QA Team")
3. Add testers by email (must be added to App Store Connect users first)
4. Select the build
5. Click **Start Testing**

**To add users to App Store Connect:**
1. Go to **Users and Access**
2. Click **+** → **Invite Users**
3. Enter email and assign role (App Manager or Developer)

### 4. Add External Testers (Beta Review Required)

**External Testers** (up to 10,000, requires Beta App Review):
1. Go to **External Testing** tab
2. Click **+** to create group (e.g., "Public Beta")
3. Add testers by email
4. Fill in Beta App Review information:
   - **Beta App Description**: What your app does
   - **Feedback Email**: Support email
   - **Marketing URL**: Your website
   - **Privacy Policy URL**: **Required**
   - **What to Test**: Instructions for testers
   - **Contact Information**: Your contact details
5. Submit for Beta App Review (usually approved in 24-48 hours)
6. Once approved, select build and click **Start Testing**

### 5. Testers Install TestFlight

Testers need to:
1. Install **TestFlight** app from App Store
2. Accept email invitation
3. Open TestFlight and install your app
4. Provide feedback via TestFlight

### 6. Monitor Feedback

- Check **TestFlight** tab for crash reports and feedback
- Review **Analytics** for usage data
- Address critical issues before App Store submission

---

## App Store Submission

### 1. Prepare App Store Listing

In App Store Connect, go to **App Information**:

**Required Information:**
- **Name**: AI News Aggregator (30 characters max)
- **Subtitle**: Brief tagline (30 characters max)
- **Category**: 
  - Primary: News
  - Secondary: (optional)
- **Content Rights**: Confirm you have rights to all content
- **Age Rating**: Complete questionnaire (likely 4+ for news app)

**Pricing and Availability:**
- **Price**: Free or Paid
- **Availability**: Select countries (or All)

### 2. Add App Store Screenshots

1. Go to **App Store** → **iOS App** → **1.0 Prepare for Submission**
2. Upload screenshots for each required device size
3. Add screenshot descriptions (optional but recommended)

**Screenshot Requirements:**
- PNG or JPEG format
- No transparency
- No device frames (iOS adds automatically)
- Show actual app functionality
- At least 3 screenshots required

### 3. Write App Description

**App Description** (up to 4,000 characters):
```
AI News Aggregator - Your Personalized News Hub

Stay informed with AI-powered news aggregation that brings you the latest stories from your favorite sources, filtered by your interests.

KEY FEATURES:
• Multi-source News Aggregation
• Smart Keyword Filtering
• Latest News First
• Fake News Detection
• Clickbait Detection
• Phishing Protection
• Personalized Feed
• Subscription Management

[Add more details about your app]
```

**Keywords** (100 characters max, comma-separated):
```
news,aggregator,AI,artificial intelligence,personalized,filter,fake news detection
```

**Promotional Text** (170 characters, can be updated without review):
```
Get personalized news from your favorite sources, filtered by AI. Stay informed, stay safe.
```

**Support URL**: Your support website
**Marketing URL**: Your marketing website (optional)

### 4. Build App Version

1. In **App Store** → **iOS App** → **1.0 Prepare for Submission**
2. Under **Build**, click **+** → Select your TestFlight build
3. If build doesn't appear, ensure it's processed in TestFlight

### 5. Complete App Review Information

**Contact Information:**
- **First Name**: Your first name
- **Last Name**: Your last name
- **Phone Number**: Your phone number
- **Email**: Your email

**Demo Account** (if app requires login):
- Provide test account credentials
- Add notes about what reviewers should test

**Notes** (optional):
- Explain any special features
- Provide context for reviewers

**Advertising Identifier** (if using):
- Select if your app uses IDFA

### 6. Export Compliance

Answer questions:
- **Does your app use encryption?**: Usually "Yes" (HTTPS counts)
- **Uses encryption**: Select "Yes, and I will provide documentation"
- **App Uses Non-Exempt Encryption**: Usually "No" (unless using custom encryption)

### 7. Content Rights

- Confirm you have rights to all content
- If using third-party content, ensure you have licenses

### 8. Submit for Review

1. Review all information
2. Click **Add for Review** → **Submit for Review**
3. Status changes to **Waiting for Review**

**Review Timeline:**
- Usually 24-48 hours
- Can take up to 7 days
- Check email for updates

### 9. Handle Review Feedback

If rejected:
1. Read rejection reasons carefully
2. Address issues in app or metadata
3. Submit new build if needed
4. Resubmit with explanation

Common rejection reasons:
- Missing privacy policy
- App crashes
- Missing functionality described in description
- Violation of App Store guidelines

---

## Post-Release

### 1. Monitor App Store Connect

- **Sales and Trends**: Track downloads and revenue
- **App Analytics**: User engagement metrics
- **Reviews and Ratings**: Respond to user feedback
- **Crash Reports**: Fix critical issues

### 2. Update App Version

For future updates:

1. **Update version in `app.json`:**
   ```json
   "version": "1.0.1"  // Increment version
   "ios": {
     "buildNumber": "2"  // Increment build number
   }
   ```

2. **Build new version:**
   ```bash
   cd mobile
   eas build --platform ios --profile production
   ```

3. **Submit update:**
   ```bash
   eas submit --platform ios
   ```
   
   Or manually in App Store Connect:
   - Create new version (e.g., 1.0.1)
   - Select new build
   - Update what's new section
   - Submit for review

### 3. Respond to Reviews

- Monitor App Store reviews
- Respond professionally to user feedback
- Address common issues in updates

### 4. Marketing

- Announce release on social media
- Update website with App Store link
- Consider press release
- Monitor analytics and iterate

---

## Troubleshooting

### Build Fails

**Error: "No Apple Developer account found"**
```bash
eas credentials
# Re-link your Apple Developer account
```

**Error: "Bundle identifier already exists"**
- Change `bundleIdentifier` in `app.json` to unique value
- Or use existing app in App Store Connect

**Error: "Invalid provisioning profile"**
```bash
eas credentials
# Let EAS regenerate provisioning profiles
```

### TestFlight Issues

**Build stuck in "Processing"**
- Wait up to 30 minutes
- Check App Store Connect for error messages
- Rebuild if necessary

**Testers can't install**
- Ensure they accepted email invitation
- Check TestFlight app is installed
- Verify build is "Ready to Submit"

### App Store Submission Issues

**Missing compliance information**
- Complete Export Compliance section
- Answer encryption questions

**Rejected for missing privacy policy**
- Add privacy policy URL in App Information
- Ensure URL is accessible

**Build not appearing**
- Ensure build is processed in TestFlight
- Check build number is higher than previous
- Wait a few minutes and refresh

---

## Quick Reference Commands

```bash
# Login to Expo
eas login

# Configure build
eas build:configure

# Build for iOS (production)
cd mobile
eas build --platform ios --profile production

# Check build status
eas build:list

# Submit to App Store
eas submit --platform ios

# Update credentials
eas credentials

# View build logs
eas build:view [build-id]
```

---

## Additional Resources

- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [TestFlight Beta Testing Guide](https://developer.apple.com/testflight/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Expo EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)

---

## Checklist Summary

### Before Building
- [ ] Apple Developer account active
- [ ] App ID created in Developer Portal
- [ ] App created in App Store Connect
- [ ] `app.json` configured correctly
- [ ] `eas.json` created and configured
- [ ] App icons and splash screens ready
- [ ] Privacy policy URL available
- [ ] Production API deployed

### TestFlight
- [ ] Build completed successfully
- [ ] Build processed in App Store Connect
- [ ] Test information filled in
- [ ] Internal testers added
- [ ] External testers added (if needed)
- [ ] Beta App Review submitted (for external)
- [ ] Testing completed

### App Store Submission
- [ ] App Store listing complete
- [ ] Screenshots uploaded
- [ ] Description written
- [ ] Keywords optimized
- [ ] Build selected
- [ ] Review information complete
- [ ] Export compliance answered
- [ ] Submitted for review

### Post-Release
- [ ] Monitoring analytics
- [ ] Responding to reviews
- [ ] Planning updates
- [ ] Marketing campaign

---

**Good luck with your iOS app release! 🚀**

