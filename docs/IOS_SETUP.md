# Badski – iOS Kurulum Rehberi

Bu rehber, Badski uygulamasını iOS’ta derleyip cihaz/simülatörde çalıştırmak ve App Store’a hazırlamak için gereken adımları kapsar.

---

## 1. Gereksinimler

| Araç | Minimum sürüm / not |
|------|----------------------|
| **macOS** | Son sürüm (Xcode ile uyumlu) |
| **Xcode** | 15.x veya üzeri (App Store’dan) |
| **Node.js** | 18+ (LTS önerilir) |
| **CocoaPods** | `gem install cocoapods` |
| **Apple Developer hesabı** | Cihazda çalıştırma / dağıtım için gerekli |

---

## 2. Proje Bilgileri (Developer Portal ile uyumlu)

Bu değerleri **Apple Developer Portal** ve **Xcode** tarafında aynı tutun:

| Ayar | Değer |
|------|--------|
| **Bundle ID** | `com.badski.start` |
| **App (Display) adı** | Badski |
| **Team** | Apple Developer hesabınıza bağlı Team ID |

---

## 3. Yerel Ortam Kurulumu

```bash
# Repo kökünde
cd Badski

# Bağımlılıklar
npm install

# iOS pod’ları
cd ios && pod install && cd ..
```

Simülatörde çalıştırma:

```bash
npm run ios
# veya belirli cihaz
npx react-native run-ios --simulator="iPhone 15"
```

---

## 4. Apple Developer Portal’da Yapılacaklar

### 4.1 Giriş

1. [developer.apple.com](https://developer.apple.com) → **Account** ile giriş yapın.
2. **Certificates, Identifiers & Profiles** bölümüne girin.

---

### 4.2 App ID (Bundle Identifier) ekleme

1. Soldan **Identifiers** → **+** (yeni identifier).
2. **App IDs** seçin → **Continue**.
3. **App** seçin → **Continue**.
4. Aşağıdaki gibi doldurun:
   - **Description:** `Badski` (veya istediğiniz açıklama).
   - **Bundle ID:** **Explicit** seçin.
   - **Bundle ID:** `com.badski.start` (projedeki ile birebir aynı olmalı).
5. Gerekli **Capabilities** (Push, Sign in with Apple, vb.) varsa işaretleyin; yoksa sadece **Register** ile kaydedin.

Bu adımda oluşan **App ID**, provisioning profile oluştururken kullanılacak.

---

### 4.3 Sertifikalar (Certificates)

**Development (geliştirme / cihaza yükleme):**

1. **Certificates** → **+**.
2. **Apple Development** seçin → **Continue**.
3. **Create a new certificate** (CSV oluşturma) adımlarını izleyin.
4. Oluşan `.cer` dosyasını indirip çift tıklayarak Keychain’e ekleyin.

**Distribution (TestFlight / App Store):**

1. **Certificates** → **+**.
2. **Apple Distribution** seçin → **Continue**.
3. Yine CSV ile sertifika oluşturup `.cer`’i indirin ve Keychain’e ekleyin.

---

### 4.4 Cihazları kaydetme (gerçek cihaz için)

Sadece gerçek iPhone/iPad’de test edecekseniz:

1. **Devices** → **+**.
2. **Register a single device** veya toplu liste yükleyin.
3. **Device Name** ve **UDID** girin (UDID: Xcode → Window → Devices and Simulators’dan alınabilir).

---

### 4.5 Provisioning Profiles

**Development profile (cihazda debug):**

1. **Profiles** → **+**.
2. **iOS App Development** → **Continue**.
3. **App ID:** `com.badski.start` (yukarıda oluşturduğunuz) seçin → **Continue**.
4. Sertifika: Geliştirme sertifikanızı seçin → **Continue**.
5. Cihaz(lar): Test edeceğiniz cihazları seçin → **Continue**.
6. **Profile Name:** örn. `Badski Development` → **Generate**.
7. Profili indirip çift tıklayarak Xcode’a yükleyin.

**Distribution profile (TestFlight / App Store):**

1. **Profiles** → **+**.
2. **App Store Connect** (veya **Ad Hoc** sadece belirli cihazlara dağıtım için) → **Continue**.
3. **App ID:** `com.badski.start` seçin → **Continue**.
4. **Distribution** sertifikanızı seçin → **Continue**.
5. Gerekirse **App Store Connect**’teki uygulamayı seçin → **Generate**.
6. Profili indirip çift tıklayarak yükleyin.

---

## 5. Xcode’da Ayarlar

1. **ios/Badski.xcworkspace** dosyasını Xcode ile açın (`.xcodeproj` değil).
2. Sol taraftan **Badski** projesini seçin → **Signing & Capabilities** sekmesi.
3. **Team:** Apple Developer hesabınızı (veya doğru takımı) seçin.
4. **Bundle Identifier:** `com.badski.start` olduğundan emin olun (genelde otomatik gelir).
5. **Automatically manage signing** işaretliyse Xcode, uygun provisioning profile’ı seçer; hata alırsanız **Profiles** bölümünden doğru Development / Distribution profile’ı manuel seçin.

---

## 6. Gerçek Cihazda Çalıştırma

1. iPhone’u USB ile bağlayın, güvenilir cihaz olarak onaylayın.
2. Xcode’da üstteki cihaz listesinden cihazınızı seçin.
3. **Run** (▶) ile derleyip yükleyin.  
   Veya terminalden:
   ```bash
   npx react-native run-ios --device
   ```
4. İlk seferde cihazda **Ayarlar → Genel → VPN ve Cihaz Yönetimi** altından geliştirici sertifikanıza “Güven” deyin.

---

## 7. Özet Tablo (Developer Portal)

| Ne yapıyorsunuz? | Nerede? | Değer / not |
|-------------------|---------|-------------|
| App ID ekleme | Identifiers → + | Bundle ID: `com.badski.start` |
| Development sertifika | Certificates → + | Apple Development |
| Distribution sertifika | Certificates → + | Apple Distribution |
| Cihaz kaydı | Devices → + | UDID, isim |
| Development profile | Profiles → + | App ID + Development cert + cihaz |
| Distribution profile | Profiles → + | App ID + Distribution cert |

---

## 8. Sık Karşılaşılan Hatalar

- **“No signing certificate”:** Sertifikayı Portal’dan oluşturup indirdikten sonra `.cer`’e çift tıklayarak Keychain’e ekleyin; Xcode’u yeniden başlatın.
- **“Bundle ID doesn’t match”:** Xcode ve Portal’daki Bundle ID’nin `com.badski.start` ile birebir aynı olduğunu kontrol edin.
- **“Device not registered”:** Cihazı Developer Portal → Devices’a ekleyin ve Development profile’ı bu cihazı içerecek şekilde yeniden oluşturup indirin.
- **Pod hatası:** `ios` klasöründe `pod install` (ve gerekirse `pod repo update`) tekrar çalıştırın.

Bu adımlar tamamlandığında proje, simülatör ve gerçek cihazda çalışır; dağıtım için de aynı Bundle ID ve profile’lar kullanılır.
