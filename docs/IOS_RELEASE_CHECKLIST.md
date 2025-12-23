# iOS Release Quick Checklist

Use this checklist to track your progress through the iOS app release process.

## Pre-Release Preparation

### Accounts & Tools
- [ ] Apple Developer Account enrolled ($99/year)
- [ ] Xcode installed and updated
- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Expo account created at [expo.dev](https://expo.dev)
- [ ] Logged into EAS: `eas login`

### App Configuration
- [ ] `app.json` configured with correct bundle identifier
- [ ] App version set (e.g., "1.0.0")
- [ ] Build number set (e.g., "1")
- [ ] App icon prepared (1024x1024px PNG)
- [ ] Splash screen prepared
- [ ] Privacy policy URL ready
- [ ] Support email configured
- [ ] Production API URL configured

### Apple Developer Portal
- [ ] App ID created: `com.ainews.aggregator`
- [ ] Distribution certificate created
- [ ] App created in App Store Connect
- [ ] Team ID noted

### App Store Connect Setup
- [ ] App Store listing created
- [ ] App name, subtitle, description written
- [ ] Keywords prepared (100 chars max)
- [ ] Screenshots prepared for all required sizes:
  - [ ] iPhone 6.7" (1290 x 2796)
  - [ ] iPhone 6.5" (1284 x 2778)
  - [ ] iPhone 5.5" (1242 x 2208)
  - [ ] iPad Pro 12.9" (2048 x 2732)
  - [ ] iPad Pro 11" (1668 x 2388)
- [ ] App category selected (News)
- [ ] Age rating completed
- [ ] Pricing set (Free/Paid)

## Build Configuration

- [ ] `eas.json` created in `mobile/` directory
- [ ] EAS build configured: `eas build:configure`
- [ ] Apple Developer account linked: `eas credentials`
- [ ] Project ID added to `app.json` (after first build)

## TestFlight Beta Testing

### Build
- [ ] Production build created: `eas build --platform ios --profile production`
- [ ] Build completed successfully
- [ ] Build processed in App Store Connect (5-15 min wait)

### Internal Testing
- [ ] Test information filled in TestFlight
- [ ] Privacy policy URL added
- [ ] Internal testers added to App Store Connect
- [ ] Internal testing group created
- [ ] Build assigned to internal testers
- [ ] Internal testing started
- [ ] App tested by internal team

### External Testing (Optional)
- [ ] External testing group created
- [ ] Beta App Review information completed:
  - [ ] Beta app description
  - [ ] Feedback email
  - [ ] Marketing URL
  - [ ] Privacy policy URL
  - [ ] What to test instructions
  - [ ] Contact information
- [ ] Beta App Review submitted
- [ ] Beta App Review approved (24-48 hours)
- [ ] External testers added
- [ ] Build assigned to external testers
- [ ] External testing started
- [ ] Feedback collected and issues addressed

## App Store Submission

### App Store Listing
- [ ] App name finalized (30 chars max)
- [ ] Subtitle written (30 chars max)
- [ ] Description written (4,000 chars max)
- [ ] Promotional text written (170 chars, can update without review)
- [ ] Keywords optimized (100 chars max)
- [ ] Support URL added
- [ ] Marketing URL added (optional)
- [ ] Screenshots uploaded for all sizes
- [ ] App preview video (optional)

### Submission Details
- [ ] Build selected in App Store Connect
- [ ] Version information complete
- [ ] App Review Information:
  - [ ] Contact information filled
  - [ ] Demo account provided (if needed)
  - [ ] Notes for reviewers added
- [ ] Export Compliance answered
- [ ] Content Rights confirmed
- [ ] Advertising Identifier set (if applicable)

### Submit
- [ ] All information reviewed
- [ ] App submitted for review
- [ ] Status: "Waiting for Review"

### Review Process
- [ ] Review completed (usually 24-48 hours)
- [ ] App approved OR
- [ ] Issues addressed if rejected
- [ ] Resubmitted if needed

## Post-Release

- [ ] App released to App Store
- [ ] App Store listing verified
- [ ] Analytics monitoring set up
- [ ] Review monitoring active
- [ ] Support email monitored
- [ ] Crash reports reviewed
- [ ] Marketing campaign launched
- [ ] Social media announcements posted

## Future Updates

For each update:
- [ ] Version incremented in `app.json` (e.g., "1.0.1")
- [ ] Build number incremented (e.g., "2")
- [ ] Changes documented in "What's New"
- [ ] New build created
- [ ] Submitted for review

---

## Quick Command Reference

```bash
# Initial Setup
npm install -g eas-cli
cd mobile
eas login
eas build:configure
eas credentials  # Link Apple Developer account

# Build
eas build --platform ios --profile production

# Check Status
eas build:list

# Submit
eas submit --platform ios
```

---

**See [IOS_RELEASE_GUIDE.md](./IOS_RELEASE_GUIDE.md) for detailed instructions.**

