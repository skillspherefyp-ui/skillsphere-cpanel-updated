# SkillSphere Android APK — Complete Build & Upload Guide

---

## PART 1 — ZAROORI SOFTWARE (Pehle Install Karo)

### 1. Node.js
- **Version:** 18+ (humne v24.11.0 use kiya)
- **Download:** https://nodejs.org → "LTS" wala download karo
- Install hone ke baad check karo: `node --version`

### 2. Java Development Kit (JDK)
- **Version:** JDK 17 (zaroori hai — 11 ya 21 kaam nahi karega properly)
- **Download:** https://adoptium.net → "Temurin 17" download karo
- Install hone ke baad check karo: `java -version`

### 3. Android Studio
- **Download:** https://developer.android.com/studio
- Install karo aur pehli baar open karo
- Andar se yeh download karo (SDK Manager se):
  - Android SDK Platform 33
  - Android SDK Build-Tools 33.0.0
  - Android NDK 23.1.7779620
  - Android Emulator (optional)

### 4. Environment Variables Set Karo (Windows)
Start Menu → "Environment Variables" search karo → System Variables mein:

```
ANDROID_HOME = C:\Users\<tumhara-naam>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Eclipse Adoptium\jdk-17...
```

Path mein yeh add karo:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%JAVA_HOME%\bin
```

---

## PART 2 — PROJECT SETUP

### Project Structure (Monorepo)
```
C:\sk\                          ← Root (junction/shortcut)
├── node_modules\               ← Saari libraries yahan hain
├── AppAndroidSS\               ← React Native app
│   ├── android\                ← Android native code
│   │   ├── app\
│   │   │   └── build.gradle
│   │   ├── build.gradle
│   │   ├── gradle.properties
│   │   └── local.properties    ← SDK path (manually banana padta hai)
│   ├── src\
│   └── package.json
└── package.json
```

> **NOTE:** `C:\sk` ek Windows Junction hai jo actual project folder
> `C:\Users\danis\OneDrive\Documents\GitHub\skill-sphere-Cpanel` ki taraf point karta hai.
> Yeh isliye banaya kyunki Gradle/CMake long paths handle nahi kar sakta Windows pe.

### Junction Banana (Sirf ek baar)
PowerShell mein Admin se chalaao:
```powershell
cmd /c mklink /J C:\sk "C:\Users\danis\OneDrive\Documents\GitHub\skill-sphere-Cpanel"
```

---

## PART 3 — local.properties FILE (Bohot Zaroori)

Yeh file `C:\sk\AppAndroidSS\android\local.properties` manually banana padti hai.
**PowerShell se banao** (normal way se nahi — BOM issue aata hai):

```powershell
[System.IO.File]::WriteAllText(
    "C:\sk\AppAndroidSS\android\local.properties",
    "sdk.dir=C\:\\Users\\danis\\AppData\\Local\\Android\\Sdk`n",
    [System.Text.UTF8Encoding]::new($false)
)
```

**Kyun yeh special way?**
- PowerShell ka normal `Set-Content -Encoding UTF8` file ke shuru mein BOM (Byte Order Mark) add karta hai
- Gradle BOM wali file read nahi kar sakta → "SDK location not found" error aata hai
- Upar wala method BOM ke bina UTF-8 likhta hai

---

## PART 4 — DEPENDENCIES INSTALL KARO

Project root (`C:\sk`) mein:
```bash
npm install
```

Ya agar sirf AppAndroidSS ke liye:
```bash
cd C:\sk\AppAndroidSS
npm install
```

---

## PART 5 — APK BANANA (Build Process)

### Command
PowerShell mein:
```powershell
cd C:\sk\AppAndroidSS\android
.\gradlew.bat assembleRelease --no-daemon
```

### Build Time
- **Pehli baar:** 10-15 minute (sab kuch download hota hai)
- **Baad mein:** 2-3 minute (cache se fast hota hai)

### APK Location
Build ke baad APK yahan milega:
```
C:\sk\AppAndroidSS\android\app\build\outputs\apk\release\app-release.apk
```

### Size
~30 MB

---

## PART 6 — MASLAY AUR UNKE SOLUTIONS

### Masla 0: APK Install Hoti Hai Lekin Open Hote Hi Band Ho Jaati Hai (WHITE SCREEN)

Yeh **sabse bada aur frustrating masla** tha. APK successfully install hoti thi,
icon pe tap karte, ek second ke liye kuch nazar aata aur phir app band ho jaati.
Baar baar karne pe same result.

**Wajah:** Release build mein JavaScript error hoti hai toh debug build jaisa
red error screen nahi aata — sirf white screen aati hai aur app silently crash kar ke
band ho jaati hai.

---

**Teen alag crash wajahaat thi — ek ke baad ek:**

---

#### Crash #1 — expo-updates EAS URL (Pehla Crash)

**Error (logcat mein):**
```
expo-updates is enabled and set to check for OTA updates on every launch
from https://u.expo.dev/0deb8d7b-... — EAS project URL is not configured
```

**Kya hua:** `expo-updates` package app mein enabled tha. Yeh package app khulte hi
Expo ke EAS (Expo Application Services) server se update check karta hai.
Hamara EAS account configure nahi tha, toh yeh crash ho jaata tha.

**Fix:** `AndroidManifest.xml` mein expo-updates disable kiya:
```xml
<meta-data android:name="expo.modules.updates.ENABLED" android:value="false"/>
```

---

#### Crash #2 — JSC Engine (Regex Error)

**Error (logcat mein):**
```
Invalid regular expression: invalid group specifier name
```

**Kya hua:** App JSC (JavaScriptCore) JavaScript engine use kar rahi thi.
React Navigation modern JavaScript regex features (named capture groups) use karta hai
jo JSC support nahi karta → crash.

**Fix:** **Hermes** JavaScript engine enable kiya.
Hermes React Native ka recommended engine hai — faster hai aur sab modern JS support karta hai.

`gradle.properties` mein:
```properties
hermesEnabled=true
```

`android/app/build.gradle` mein hermesc ka exact Windows path diya:
```gradle
hermesCommand = "C:/sk/node_modules/react-native/sdks/hermesc/win64-bin/hermesc.exe"
```

---

#### Crash #3 — window.location Undefined

**Error (logcat mein):**
```
TypeError: Cannot read property 'origin' of undefined
```

**Kya hua:** `LoginScreen.js` mein yeh code tha:
```js
if (typeof window !== 'undefined') {
    const origin = window.location.origin  // ← CRASH yahan
}
```

Android mein `window` object exist karta hai (partial polyfill), lekin
`window.location` undefined hota hai. Toh check pass ho jaata tha lekin
`.origin` access karne pe crash.

**Fix:** Check ko aur specific banaya:
```js
if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin  // ← safe hai ab
}
```

---

#### Build Errors Jo Crashes Se Pehle Aaye

Yeh build karne ke dauran aaye, APK banti hi nahi thi:

**Build Error 1 — Path Too Long (Windows)**
```
CMake error: object file path too long (186 chars, limit 250)
```
Wajah: `C:\Users\danis\OneDrive\Documents\GitHub\skill-sphere-Cpanel\` path bahut lamba tha.
Fix: `C:\sk` junction banaya (Part 2 mein explain hai).

**Build Error 2 — expo-updates JVM Mismatch**
```
expo-updates: Kotlin JVM target 11 but project requires 17
```
Fix: `expo-updates` ki `build.gradle` mein `jvmTarget = JavaVersion.VERSION_11`
ko `VERSION_17` kiya.

**Build Error 3 — expo-updates Metro Plugin**
```
app:createReleaseExpoManifest — hashAssetFiles plugin missing
```
Fix: `metro.config.js` mein `hashAssetFiles` plugin add kiya.

---

**Summary — App Crash Fix Timeline:**

```
APK banti hai  →  App khulti hai  →  Band ho jaati hai (white screen)
      ↓
[Fix 1] expo-updates disable kiya
      ↓
App khulti hai  →  Phir bhi crash
      ↓
[Fix 2] Hermes enable kiya (JSC ki jagah)
      ↓
App khulti hai  →  Sign In click karo  →  Crash
      ↓
[Fix 3] window.location.origin check fix kiya
      ↓
App perfectly kaam karti hai ✓
```

---

### Masla 1: "SDK location not found"
**Wajah:** `local.properties` file nahi hai ya BOM wali hai
**Solution:** Part 3 wala command chalaao (special PowerShell way se)

### Masla 2: Icons App Mein Nazar Nahi Aa Rahe (Empty Boxes)
**Wajah:** `react-native-vector-icons` ka `fonts.gradle` galat path use karta hai.
Default path `../../node_modules/...` (2 levels up) hai lekin monorepo mein
fonts `../../../node_modules/...` (3 levels up) pe hain.
Font files APK mein include nahi hoti thi.

**Solution:** `android/app/build.gradle` ke end mein yeh add kiya:
```gradle
project.ext.vectoricons = [
    iconFontsDir: file("../../../node_modules/react-native-vector-icons/Fonts").absolutePath
]
apply from: file("../../../node_modules/react-native-vector-icons/fonts.gradle")
```

### Masla 3: Keyboard Input Fields Ko Cover Karta Hai
**Wajah:** `KeyboardAvoidingView` mein `behavior='height'` use ho rahi thi.
Android ke `adjustResize` ke saath `height` double-resize karta hai.

**Solution:** `LoginScreen.js` aur `SignupScreen.js` mein:
```js
// Pehle (galat)
behavior={Platform.OS === 'ios' ? 'padding' : 'height'}

// Baad mein (sahi)
behavior="padding"
```

### Masla 4: App WiFi Pe Kaam Nahi Karta (Server Connect Nahi Hota)
**Wajah:** Home/office WiFi router Amazon AWS IP (`205.251.153.4`) ki TCP connections
block karta hai. Chrome QUIC/UDP use karta hai isliye browser mein kaam karta hai.
App OkHttp use karta hai jo sirf TCP use karta hai.

**Solution:** Mobile data use karo. App mobile data pe perfectly kaam karta hai.
Permanent fix ke liye router firewall settings check karo ya ISP se contact karo.

### Masla 5: "compileSdkVersion not specified"
**Wajah:** `local.properties` mein BOM tha, Gradle SDK nahi dhundh pa raha tha
**Solution:** Masla 1 ka solution

### Masla 6: PowerShell mein `$pid` variable
**Wajah:** `$pid` PowerShell ka reserved system variable hai
**Solution:** `$appPid` use karo

---

## PART 7 — ADB SE PHONE PE INSTALL KARNA

### Option A: Wireless (WiFi)
Phone pe:
1. Settings → About Phone → Build Number pe 7 baar tap karo (Developer Options unlock)
2. Developer Options → Wireless Debugging ON karo
3. "Pair device with pairing code" tap karo → IP aur port note karo

PC pe PowerShell mein:
```powershell
adb pair <ip>:<port>
# Pairing code daalo
adb connect <ip>:<port2>
adb install -r "C:\sk\AppAndroidSS\android\app\build\outputs\apk\release\app-release.apk"
```

### Option B: Manual Transfer
1. APK file USB ya WhatsApp se phone pe bhejo
2. Phone pe file open karo
3. "Install" tap karo
4. Agar "Unknown sources" warning aaye: Settings → Allow from this source → wapas aao → Install

---

## PART 8 — CPANEL KYA HAI AUR HUMNE KYA KIYA

### cPanel Kya Hota Hai?
cPanel ek **web hosting control panel** hai — yeh ek dashboard hai jahan se aap apni
website ka sara kaam karte ho bina server ka code samjhe:
- Website files upload/manage karna
- Database banana (MySQL)
- Email accounts banana
- SSL certificate lagana
- PHP settings change karna
- Domain/subdomain manage karna

**SkillSphere ka poora backend (API + website) cPanel pe hosted hai:**
```
Hosting Provider: cPanel-based shared hosting
Domain:           skillsphere.com.pk
cPanel URL:       skillsphere.com.pk/cpanel
```

---

### cPanel Pe Kya Kya Hosted Hai (SkillSphere ke liye)

```
public_html/
├── index.php          ← Main website (React web app)
├── api/               ← Backend API (Node.js/PHP)
│   └── ...
├── uploads/           ← Course images, certificates
├── downloads/         ← APK file yahan upload ki
│   └── app-release.apk
└── ...
```

---

### Humne cPanel Mein Kya Kiya Aur Kyun

#### 1. APK Upload Kiya — Download Link Ke Liye
**Kyun:** Android app distribute karne ke liye hume ek public link chahiye tha
jahan se koi bhi APK download kar sake. Google Play Store pe upload karne ki
bajaye humne directly apne server pe rakh diya.

**Steps:**
1. `skillsphere.com.pk/cpanel` login kiya
2. File Manager khola
3. `public_html/downloads/` folder banaya
4. APK file upload ki
5. Link ban gaya: `https://skillsphere.com.pk/downloads/app-release.apk`

---

#### 2. Security Section Check Kiya — App Connect Nahi Ho Rahi Thi

**Problem:** App install thi, open hoti thi, lekin jab bhi login ya signup karte
toh ~30 second baad error aata tha:
```
"Cannot connect to server. Make sure the backend is running."
```

**Humne Socha:** Shayad cPanel ki security app ko block kar rahi ho
(WAF = Web Application Firewall ya bot detection)

**cPanel Security Section Mein Yeh Check Kiya:**
- SSH Access ✓
- IP Blocker ✓
- SSL/TLS Certificates ✓
- Manage API Tokens ✓
- Hotlink Protection ✓
- Leech Protection ✓

**Findings:** cPanel mein koi advanced security nahi thi:
- ❌ Imunify360 nahi tha (advanced WAF)
- ❌ ModSecurity nahi tha (request filtering)
- ❌ Bot detection nahi tha

Matlab cPanel security app ko block nahi kar rahi thi.

---

#### 3. Asli Masla Kya Nikla

**Root Cause:** Home/office WiFi router Amazon AWS IP address
(`205.251.153.4`) ki **TCP connections block** kar raha tha.

```
SkillSphere server → Amazon AWS pe hosted hai
AWS IP: 205.251.153.4

WiFi router → TCP port 443 block kar raha tha is IP ke liye
App (OkHttp) → sirf TCP use karta hai → BLOCKED ❌

Chrome browser → QUIC/HTTP3 protocol use karta hai (UDP pe chalta hai)
               → Router UDP block nahi karta → WORKS ✓
```

**Proof:**
- Browser mein `skillsphere.com.pk/api/categories` → kaam karta tha ✓
- App WiFi pe → fail ❌
- App mobile data pe → perfectly kaam karta tha ✓

**Solution:** Mobile data use karo. Permanent fix ke liye WiFi router ki
firewall settings check karo ya ISP se contact karo.

---

#### 4. Hotlink Protection Check Kiya

**Kyun:** Suspect kiya ke cPanel ki Hotlink Protection shayad
app ke requests block kar rahi ho (kyunki app ka User-Agent browser jaisa
nahi tha).

**Finding:** Hotlink Protection images/files ke liye hoti hai, API requests
ke liye nahi. Toh yeh issue nahi tha.

**Fix jo bhi kiya:** App mein browser jaisa User-Agent add kiya:
```js
const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 
(KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';
```
Lekin WiFi block ki wajah se yeh bhi kaam nahi kiya. Mobile data pe
yeh unnecessary tha but harmless hai.

---

### cPanel Pe APK Upload Karne Ka Complete Process

#### Steps (Detailed)
1. Browser mein jao: `https://skillsphere.com.pk/cpanel`
2. Username aur password se login karo
3. **"File Manager"** dhundho aur click karo
4. Left side mein `public_html` pe click karo
5. Top mein **"+ Folder"** button → naam likho `downloads` → Create Folder
6. `downloads` folder pe double click karo (andar jao)
7. Top mein **"Upload"** button click karo
8. **"Select File"** → apna APK choose karo:
   ```
   C:\sk\AppAndroidSS\android\app\build\outputs\apk\release\app-release.apk
   ```
9. Upload hone do (~30MB, 1-2 minute lagenge)
10. Done! Link ready:
    ```
    https://skillsphere.com.pk/downloads/app-release.apk
    ```

#### New Version Upload Karna (Update)
1. cPanel → File Manager → `public_html/downloads/`
2. Purani APK file select karo → Delete karo
3. Nayi APK upload karo (same naam raho toh link same rehta hai)

#### Ya File Rename Karo (Version tracking ke liye)
```
SkillSphere-v1.0.apk   → https://skillsphere.com.pk/downloads/SkillSphere-v1.0.apk
SkillSphere-v1.1.apk   → https://skillsphere.com.pk/downloads/SkillSphere-v1.1.apk
```

---

### Summary — cPanel Role in This Project

| cPanel Use | Kyun |
|-----------|------|
| Backend API host karna | Website aur app dono ka data yahan se aata hai |
| APK file host karna | Public download link ke liye |
| SSL Certificate | HTTPS secure connection ke liye (app ka API call HTTPS use karta hai) |
| Security check karna | App connection issue debug karne ke liye (masla wahan nahi tha) |

---

## PART 9 — CPANEL PE UPLOAD KARNA (Quick Steps Reference)

### Steps
1. `skillsphere.com.pk/cpanel` pe jao aur login karo
2. **File Manager** open karo
3. `public_html` folder mein jao
4. `downloads` naam ka folder banao (ya koi bhi naam)
5. Folder open karo → **Upload** button → APK file select karo
6. Upload complete hone ka wait karo

### Download Link
```
https://skillsphere.com.pk/downloads/app-release.apk
```

### Version Naming (Recommend)
```
SkillSphere-v1.0.apk   ← pehla release
SkillSphere-v1.1.apk   ← bug fixes
SkillSphere-v1.2.apk   ← new features
```

---

## PART 9 — DEVELOPMENT WORKFLOW (APK Bar Bar Nahi Banana)

### Development Mode (Fast — JS changes ke liye)
```bash
cd C:\sk\AppAndroidSS
npx react-native start
```
- Phone same WiFi pe ho
- App open karo → Phone hilao (shake) → "Reload" tap karo
- Changes **instantly** reflect honge — koi APK nahi banana

### Kab APK Banana Padta Hai

| Change | APK Banana Padega? |
|--------|-------------------|
| Screen/UI changes | ❌ Metro reload kaafi |
| API calls change | ❌ Metro reload kaafi |
| Bug fix JS mein | ❌ Metro reload kaafi |
| Images/assets add | ❌ Metro reload kaafi |
| Java native file change | ✅ Haan |
| build.gradle change | ✅ Haan |
| AndroidManifest.xml | ✅ Haan |
| Naya native library | ✅ Haan |
| **Final release** | ✅ Haan |

---

## PART 10 — APK BANANE KE EXACT COMMANDS (Jo Humne Use Kiye)

Yeh wo exact commands hain jo humne step by step use kiye APK successfully banane ke liye.
**Sirf ek baar karne wale** aur **har baar karne wale** alag alag hain.

---

### STEP 1 — Sirf Pehli Baar: C:\sk Junction Banana
```powershell
cmd /c mklink /J C:\sk "C:\Users\danis\OneDrive\Documents\GitHub\skill-sphere-Cpanel"
```
> Yeh ek shortcut (junction) banata hai taake Gradle ko short path mile.
> Ek baar banao, hamesha kaam karega. Agar pehle se hai toh dobara mat banao.

---

### STEP 2 — Sirf Pehli Baar: local.properties Banana
```powershell
[System.IO.File]::WriteAllText(
    "C:\sk\AppAndroidSS\android\local.properties",
    "sdk.dir=C\:\\Users\\danis\\AppData\\Local\\Android\\Sdk`n",
    [System.Text.UTF8Encoding]::new($false)
)
```
> Normal `Set-Content` use mat karo — woh BOM add karta hai jo Gradle read nahi kar sakta.
> Yeh command BOM ke bina UTF-8 likhti hai.

---

### STEP 3 — Sirf Pehli Baar: Dependencies Install Karna
```powershell
cd C:\sk
npm install
```
> Saari libraries download hoti hain (React Native, Expo, sab kuch).
> Pehli baar mein time lagta hai. Baad mein fast hota hai.

---

### STEP 4 — Har Baar: APK Build Karna
```powershell
cd C:\sk\AppAndroidSS\android
.\gradlew.bat assembleRelease --no-daemon
```
> **Yeh sabse important command hai.**
> `--no-daemon` isliye use kiya kyunki Windows pe Gradle daemon
> kabhi kabhi memory issues karta hai.
>
> Pehli baar: 10-15 minute
> Baad mein (cache se): 2-3 minute

**Build successful hone pe yeh message aata hai:**
```
BUILD SUCCESSFUL in 2m 34s
871 actionable tasks: 23 executed, 848 up-to-date
```

**APK yahan ban jaati hai:**
```
C:\sk\AppAndroidSS\android\app\build\outputs\apk\release\app-release.apk
```

---

### STEP 5 — Phone Pe Install Karna

**Option A — ADB Wireless (agar phone connected ho):**
```powershell
adb install -r "C:\sk\AppAndroidSS\android\app\build\outputs\apk\release\app-release.apk"
```

**Option B — Manual (USB ya WhatsApp se bhejo):**
```
File: C:\sk\AppAndroidSS\android\app\build\outputs\apk\release\app-release.apk
```
Phone pe open karo → Install tap karo.

---

### STEP 6 — Development Mode (APK Ke Bina Test Karna)
```powershell
cd C:\sk\AppAndroidSS
npx react-native start
```
> JS changes ke liye Metro server chalaao.
> Phone pe app open karo, hilao (shake) → Reload tap karo.
> Instant changes — koi build nahi.

---

### Ek Jagah — Poora Process (Copy-Paste Ready)

**Sirf Pehli Baar (fresh setup):**
```powershell
# 1. Junction banana
cmd /c mklink /J C:\sk "C:\Users\danis\OneDrive\Documents\GitHub\skill-sphere-Cpanel"

# 2. local.properties banana
[System.IO.File]::WriteAllText("C:\sk\AppAndroidSS\android\local.properties", "sdk.dir=C\:\\Users\\danis\\AppData\\Local\\Android\\Sdk`n", [System.Text.UTF8Encoding]::new($false))

# 3. Dependencies install
cd C:\sk
npm install
```

**Har Baar APK Banane Ke Liye:**
```powershell
# APK build karo
cd C:\sk\AppAndroidSS\android
.\gradlew.bat assembleRelease --no-daemon

# Phone pe install karo (ADB se)
adb install -r "C:\sk\AppAndroidSS\android\app\build\outputs\apk\release\app-release.apk"
```

---

## PART 11 — QUICK REFERENCE (Sab Commands Ek Jagah)

```powershell
# ═══ PEHLI BAAR WALE ═══════════════════════════════════════════

# Junction banana
cmd /c mklink /J C:\sk "C:\Users\danis\OneDrive\Documents\GitHub\skill-sphere-Cpanel"

# local.properties banana (BOM ke bina)
[System.IO.File]::WriteAllText("C:\sk\AppAndroidSS\android\local.properties", "sdk.dir=C\:\\Users\\danis\\AppData\\Local\\Android\\Sdk`n", [System.Text.UTF8Encoding]::new($false))

# Dependencies install
cd C:\sk && npm install

# ═══ HAR BAAR WALE ══════════════════════════════════════════════

# APK banana
cd C:\sk\AppAndroidSS\android
.\gradlew.bat assembleRelease --no-daemon

# Phone pe install karna (ADB)
adb install -r "C:\sk\AppAndroidSS\android\app\build\outputs\apk\release\app-release.apk"

# ═══ DEVELOPMENT (JS changes test karna, APK nahi banana) ═══════

cd C:\sk\AppAndroidSS && npx react-native start

# ═══ ADB WIRELESS CONNECT KARNA ══════════════════════════════════

adb pair <phone-ip>:<pair-port>       # Pehle pair karo
adb connect <phone-ip>:<connect-port> # Phir connect karo
adb devices                           # Confirm karo device connected hai
```

---

## Project Info

| Item | Value |
|------|-------|
| React Native Version | 0.72.17 |
| React Version | 18.2.0 |
| Node.js Version | 18+ (v24 tested) |
| Java Version | JDK 17 |
| Android SDK | API 33 |
| Build Tools | 33.0.0 |
| NDK Version | 23.1.7779620 |
| Min Android | API 21 (Android 5.0) |
| Target Android | API 33 (Android 13) |
| App Package | com.skillsphere.app |
| APK Size | ~30 MB |

---

*Document created for SkillSphere FYP Project — June 2026*
