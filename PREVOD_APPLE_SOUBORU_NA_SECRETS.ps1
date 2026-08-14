param(
  [Parameter(Mandatory=$true)][string]$CertificateP12,
  [Parameter(Mandatory=$true)][string]$ProvisioningProfile
)

$certBytes = [IO.File]::ReadAllBytes((Resolve-Path $CertificateP12))
$profileBytes = [IO.File]::ReadAllBytes((Resolve-Path $ProvisioningProfile))

[Convert]::ToBase64String($certBytes) | Set-Content -NoNewline BUILD_CERTIFICATE_BASE64.txt
[Convert]::ToBase64String($profileBytes) | Set-Content -NoNewline BUILD_PROVISION_PROFILE_BASE64.txt

Write-Host "Hotovo:"
Write-Host " - BUILD_CERTIFICATE_BASE64.txt"
Write-Host " - BUILD_PROVISION_PROFILE_BASE64.txt"
