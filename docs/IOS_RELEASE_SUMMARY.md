# iOS Release Process Summary

This document provides a high-level overview of the iOS app release process. For detailed instructions, see [IOS_RELEASE_GUIDE.md](./IOS_RELEASE_GUIDE.md).

## Overview

Your AI News Aggregator app is built with **Expo** (React Native), which simplifies the iOS release process using **EAS Build** (Expo Application Services).

## Release Process Flow

```
1. Setup → 2. Build → 3. TestFlight → 4. App Store → 5. Release
```

### 1. Setup Phase (One-time)

**Time Required:** 1-2 hours

- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Create App ID in Apple Developer Portal
- [ ] Create app in App Store Connect
- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Configure EAS: `cd mobile && eas build:configure`
- [ ] Link Apple Developer account: `eas credentials`

**Key Files:**
- `mobile/app.json` - App configuration
- `mobile/eas.json` - Build configuration (created by `eas build:configure`)

### 2. Build Phase

**Time Required:** 15-30 minutes per build

```bash
cd mobile
eas build --platform ios --profile production
```

**What Happens:**
- Code is uploaded to Expo servers
- Build runs on Apple's infrastructure
- `.ipa` file is generated
- Build is automatically uploaded to App Store Connect

**Build Types:**
- **Development**: For local testing with Expo Go
- **Preview**: For internal testing (TestFlight)
- **Production**: For App Store submission

### 3. TestFlight Phase

**Time Required:** 1-3 days (including beta review if needed)

**Internal Testing** (Immediate):
- Up to 100 testers
- No App Store review required
- Instant access after build processing

**External Testing** (Requires Review):
- Up to 10,000 testers
- Requires Beta App Review (24-48 hours)
- Good for public beta testing

**Steps:**
1. Wait for build processing (5-15 minutes)
2. Add test information in App Store Connect
3. Add testers
4. Assign build to testers
5. Testers install via TestFlight app

### 4. App Store Submission Phase

**Time Required:** 2-4 hours (preparation) + 24-48 hours (review)

**Preparation:**
- Complete App Store listing
- Upload screenshots
- Write description and keywords
- Fill in review information
- Select build

**Submission:**
- Click "Submit for Review"
- Wait for review (usually 24-48 hours)
- Address any rejection issues if needed

### 5. Release Phase

**Time Required:** Immediate after approval

- App goes live automatically (or schedule release)
- Monitor analytics and reviews
- Plan updates based on feedback

## Key Configuration Values

### Bundle Identifier
```
com.ainews.aggregator
```
Must match in:
- `app.json` → `ios.bundleIdentifier`
- Apple Developer Portal → App ID
- App Store Connect → App Bundle ID

### Version Management
- **Version** (`app.json` → `version`): Semantic versioning (e.g., "1.0.0")
- **Build Number** (`app.json` → `ios.buildNumber`): Increments with each build (e.g., "1", "2", "3")

**For Updates:**
- Increment version: "1.0.0" → "1.0.1"
- Increment build number: "1" → "2"
- Build new version
- Submit update

## Common Commands

```bash
# Initial Setup
npm install -g eas-cli
cd mobile
eas login
eas build:configure
eas credentials

# Build
eas build --platform ios --profile production

# Check Status
eas build:list

# Submit to App Store
eas submit --platform ios

# View Build Logs
eas build:view [build-id]
```

## Important URLs

- **Apple Developer Portal**: https://developer.apple.com/account
- **App Store Connect**: https://appstoreconnect.apple.com
- **Expo Dashboard**: https://expo.dev
- **TestFlight**: https://testflight.apple.com (for testers)

## Cost Breakdown

- **Apple Developer Program**: $99/year (required)
- **EAS Build**: Free tier available (limited builds/month)
  - Free: 30 builds/month
  - Production: $29/month (unlimited builds)
- **App Store**: No additional fees

## Timeline Estimate

| Phase | Time |
|-------|------|
| Setup | 1-2 hours |
| First Build | 15-30 minutes |
| TestFlight Processing | 5-15 minutes |
| Internal Testing | 1-7 days (your choice) |
| Beta Review (External) | 24-48 hours |
| App Store Review | 24-48 hours |
| **Total (First Release)** | **3-7 days** |

## Troubleshooting Quick Reference

**Build Fails:**
- Check `eas.json` configuration
- Verify Apple Developer account is linked
- Check build logs: `eas build:view [build-id]`

**TestFlight Issues:**
- Ensure build is "Ready to Submit"
- Check testers are added to App Store Connect
- Verify privacy policy URL is accessible

**App Store Rejection:**
- Read rejection reasons carefully
- Address all issues
- Resubmit with explanation

## Next Steps

1. **Read Full Guide**: [IOS_RELEASE_GUIDE.md](./IOS_RELEASE_GUIDE.md)
2. **Use Checklist**: [IOS_RELEASE_CHECKLIST.md](./IOS_RELEASE_CHECKLIST.md)
3. **Start Setup**: Follow Phase 1 steps above

## Support Resources

- [Expo EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [Expo Forums](https://forums.expo.dev/)

---

**Ready to release? Start with the [iOS Release Guide](./IOS_RELEASE_GUIDE.md)!**

