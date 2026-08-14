# BC Rybárna Scoreboard Mobile – iPhone BEZ vlastního Macu

Tato varianta používá GitHub Actions. iOS projekt a IPA se sestavují na GitHubím macOS runneru.

## Co potřebuješ

### Pro první ověření projektu
Stačí:
- účet na GitHubu
- tento projekt nahraný do GitHub repozitáře

Workflow **Verify iOS Project** nevyžaduje Apple certifikát. Ověří, že iOS projekt lze vytvořit a sestavit pro simulátor.

### Pro skutečné IPA do iPhonu
Potřebuješ Apple signing:
- Apple Developer účet / odpovídající signing prostředky
- distribuční `.p12` certifikát + heslo
- provisioning profile `.mobileprovision` obsahující App ID `cz.bcrybarna.scoreboard`
- u ad-hoc distribuce musí provisioning profile obsahovat UDID iPhonu, na který aplikaci instaluješ

Apple uvádí, že ad-hoc profil vyžaduje App ID, distribuční certifikát a registrovaná zařízení.

## 1. Nahraj projekt na GitHub

Na Windows:
1. Vytvoř nový soukromý GitHub repozitář.
2. Nahraj do něj celý obsah této složky.
3. Musí být vidět i složka `.github/workflows`.

Na GitHubu pak otevři:
**Actions → Verify iOS Project → Run workflow**

Pokud projde, zdroj aplikace je v pořádku.

## 2. Připrav signing secrets

GitHub oficiálně doporučuje ukládat Apple certifikát a provisioning profile jako Base64 secrets.

Ve Windows můžeš použít přiložený PowerShell skript:

```powershell
powershell -ExecutionPolicy Bypass -File .\PREVOD_APPLE_SOUBORU_NA_SECRETS.ps1 `
  -CertificateP12 "C:\cesta\certifikat.p12" `
  -ProvisioningProfile "C:\cesta\profil.mobileprovision"
```

Vzniknou:
- `BUILD_CERTIFICATE_BASE64.txt`
- `BUILD_PROVISION_PROFILE_BASE64.txt`

## 3. Přidej GitHub Secrets

GitHub repo:
**Settings → Secrets and variables → Actions → New repository secret**

Vytvoř:

- `BUILD_CERTIFICATE_BASE64`
  - obsah `BUILD_CERTIFICATE_BASE64.txt`

- `P12_PASSWORD`
  - heslo k `.p12`

- `BUILD_PROVISION_PROFILE_BASE64`
  - obsah `BUILD_PROVISION_PROFILE_BASE64.txt`

- `KEYCHAIN_PASSWORD`
  - libovolné silné jednorázové heslo, např. dlouhé náhodné heslo

## 4. Sestav IPA

Na GitHubu:

**Actions → Build iOS IPA → Run workflow**

GitHub:
1. spustí macOS runner,
2. nainstaluje Node.js,
3. nainstaluje Capacitor,
4. vytvoří iOS Xcode projekt,
5. nainstaluje tvůj signing certifikát a provisioning profile,
6. udělá Xcode Archive,
7. exportuje `.ipa`,
8. uloží IPA jako GitHub Actions Artifact.

Po dokončení otevři běh workflow a stáhni:

**BC-Rybarna-Scoreboard-iOS**

## 5. Instalace na iPhone

Samotné stažení `.ipa` do iPhonu není totéž jako instalace.
Pro ad-hoc instalaci musí být iPhone uveden v provisioning profilu a IPA musí být správně podepsaná.

Možnosti distribuce:
- ad-hoc na registrované zařízení
- TestFlight / App Store Connect
- další Apple podporovaná firemní/distribuční cesta podle typu účtu

## Důležité

GitHub Actions nahrazuje fyzický Mac pro BUILD, ale nenahrazuje Apple signing a provisioning.
To je omezení iOS, nikoli BC Rybárna Scoreboardu.

## Workflow soubory

- `.github/workflows/verify-ios.yml`
  - ověří projekt bez podpisu

- `.github/workflows/build-ios.yml`
  - vytvoří podepsané IPA
