param([ValidateSet('PasswordHash','EncryptionKey')][string]$Kind='PasswordHash')
$ErrorActionPreference='Stop'
$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
if($Kind -eq 'EncryptionKey'){
 $bytes=New-Object byte[] 32;$rng.GetBytes($bytes)
 Set-Clipboard -Value ([Convert]::ToBase64String($bytes))
 [Array]::Clear($bytes,0,$bytes.Length)
 Write-Host 'ADMIN_ENCRYPTION_KEY nueva copiada al portapapeles. Pégala solo en Vercel, proyecto visor-reservas-sunass.'
}else{
 $secure=Read-Host 'Escribe localmente la misma contraseña conocida del admin original' -AsSecureString
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try{
  $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $salt=New-Object byte[] 24;$rng.GetBytes($salt)
  $kdf=[Security.Cryptography.Rfc2898DeriveBytes]::new($plain,$salt,600000,[Security.Cryptography.HashAlgorithmName]::SHA256)
  $hash=$kdf.GetBytes(32)
  Set-Clipboard -Value ('600000$'+[Convert]::ToBase64String($salt)+'$'+[Convert]::ToBase64String($hash))
  $kdf.Dispose();[Array]::Clear($hash,0,$hash.Length);$plain=$null
  Write-Host 'Hash nuevo con sal independiente copiado al portapapeles. Pégalo solo como ADMIN_PASSWORD_HASH del proyecto visor-reservas-sunass.'
 }finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$secure.Dispose()}
}
$rng.Dispose()
Write-Host 'Después de pegarlo, limpia el portapapeles con: Set-Clipboard -Value ""'
