param([switch]$SelfTest)

# Read-only Telegram diagnostics. No offset, webhook mutation, or token persistence.
# ASCII messages keep Windows PowerShell 5.1 file decoding predictable.
function Invoke-TelegramDiagnostic {
    param([scriptblock]$Request, [scriptblock]$Emit, [scriptblock]$Prompt)

    $me = & $Request 'getMe' @{}
    if (-not $me.ok) { & $Emit "Khong xac minh duoc bot ($($me.code))."; return }
    & $Emit "Bot: @$($me.result.username)"

    $webhook = & $Request 'getWebhookInfo' @{}
    if (-not $webhook.ok) { & $Emit "Khong kiem tra duoc webhook ($($webhook.code))."; return }
    & $Emit "Tin dang cho: $($webhook.result.pending_update_count)"
    if ($webhook.result.url) {
        & $Emit 'Webhook DANG BAT. getUpdates khong dung duoc trong trang thai nay.'
        & $Emit 'Khong tu xoa webhook. Bao lai dong nay cho agent; URL duoc an.'
        return
    }

    $marker = 'id-' + [Guid]::NewGuid().ToString('N').Substring(0, 10)
    & $Emit "Mo dung bot @$($me.result.username) tren dien thoai va gui RIENG tin: $marker"
    & $Prompt
    $updates = & $Request 'getUpdates' @{timeout = 10; limit = 100}
    if (-not $updates.ok) {
        switch ($updates.code) {
            401 { & $Emit 'Token khong hop le hoac da bi thu hoi.' }
            409 { & $Emit 'Xung dot: co the webhook vua bat hoac tien trinh khac dang getUpdates. Khong tu tat tien trinh.' }
            429 { & $Emit 'Telegram gioi han tan suat. Dung thu lien tuc, doi roi chay lai.' }
            default { & $Emit "Khong doc duoc tin ($($updates.code)); loi chi tiet da an de bao ve token." }
        }
        return
    }
    $items = @($updates.result)
    $matches = @($items | Where-Object {
        $_.message.chat.type -eq 'private' -and
        $_.message.from.is_bot -ne $true -and
        $_.message.from.id -eq $_.message.chat.id -and
        $_.message.text -ceq $marker
    } | ForEach-Object { [string]$_.message.from.id } | Select-Object -Unique)

    if ($matches.Count -eq 1) {
        & $Emit "Telegram user ID cua nguoi gui ma: $($matches[0])"
        & $Emit 'Neu chinh ban gui ma tren, luu day so nay bang lenh:'
        & $Emit 'npx.cmd wrangler secret put TELEGRAM_USER_ID --env staging'
    } elseif ($matches.Count -gt 1) {
        & $Emit 'Nhieu nguoi gui cung ma. Chua chon ID; chay lai voi ma moi va khong chia se ma.'
    } elseif ($items.Count -ge 100) {
        & $Emit 'Hang doi co it nhat 100 tin; tin moi co the nam phia sau. Khong tu bo qua/xoa tin.'
    } elseif ($items.Count -eq 0) {
        & $Emit 'Telegram tra ve 0 tin. Kiem tra dung username va tin vua gui; co the tien trinh khac da lay tin.'
    } else {
        & $Emit "Nhan $($items.Count) update nhung khong co ma vua gui trong chat rieng. Khong doan ID tu nguoi khac."
    }
}

if ($SelfTest) {
    # Fakes only: no token prompt, network, Cloudflare or Telegram changes.
    foreach ($scenario in @('match', 'webhook', 'empty', 'conflict', 'full', 'wrong')) {
        $state = @{marker = ''; calls = 0; lines = [Collections.Generic.List[string]]::new()}
        $emit = {
            param($line)
            $state.lines.Add([string]$line)
            if ($line -match 'tin: (id-[a-f0-9]+)$') { $state.marker = $Matches[1] }
        }
        $fake = {
            param($method, $body)
            $state.calls++
            if ($method -eq 'getMe') { return @{ok = $true; result = @{username = 'test_bot'}} }
            if ($method -eq 'getWebhookInfo') {
                return @{ok = $true; result = @{url = $(if ($scenario -eq 'webhook') {'hidden-url'} else {''}); pending_update_count = 0}}
            }
            if ($method -ne 'getUpdates' -or $body.ContainsKey('offset')) { throw 'Unexpected mutation or method' }
            if ($scenario -eq 'conflict') { return @{ok = $false; code = 409} }
            $result = @()
            if ($scenario -eq 'match') {
                $result = @(@{message = @{chat = @{type = 'private'; id = 123}; from = @{id = 123; is_bot = $false}; text = $state.marker}})
            }
            if ($scenario -eq 'wrong') { $result = @(@{message = @{text = 'other'}}) }
            if ($scenario -eq 'full') { $result = @(1..100 | ForEach-Object { @{update_id = $_} }) }
            return @{ok = $true; result = $result}
        }
        Invoke-TelegramDiagnostic $fake $emit {}
        $output = $state.lines -join "`n"
        $expected = @{match = 'ID cua nguoi gui ma: 123'; webhook = 'Webhook DANG BAT'; empty = '0 tin'; conflict = 'Xung dot'; full = '100 tin'; wrong = 'khong co ma'}[$scenario]
        if (-not $output.Contains($expected) -or $output.Contains('hidden-url')) { throw "Self-test failed: $scenario" }
        if ($scenario -eq 'webhook' -and $state.calls -ne 2) { throw 'Polled with webhook enabled' }
    }
    Write-Host 'PASS: 6 offline diagnostic scenarios. No network calls.'
    return
}

$secureToken = $null
$plainToken = $null
$client = $null
$handler = $null
try {
    Add-Type -AssemblyName System.Net.Http
    $secureToken = Read-Host 'Nhap token bot MOI (an ky tu)' -AsSecureString
    $plainToken = [System.Net.NetworkCredential]::new('', $secureToken).Password.Trim()
    if ($plainToken -notmatch '^\d+:[A-Za-z0-9_-]+$') {
        Write-Host 'Token sai dinh dang. Copy gia tri goc tu BotFather, khong copy Markdown.'
        return
    }
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(20)
    $request = {
        param($method, $body)
        $content = $null
        $response = $null
        try {
            if ($method -notin @('getMe', 'getWebhookInfo', 'getUpdates')) { return @{ok = $false; code = 'METHOD_DENIED'} }
            $content = [System.Net.Http.StringContent]::new(($body | ConvertTo-Json -Compress), [Text.Encoding]::UTF8, 'application/json')
            $response = $client.PostAsync(('https://api.telegram.org/bot' + $plainToken + '/' + $method), $content).GetAwaiter().GetResult()
            if (-not $response.IsSuccessStatusCode) { return @{ok = $false; code = [int]$response.StatusCode} }
            $data = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
            if (-not $data.ok) { return @{ok = $false; code = 'API_REJECTED'} }
            return @{ok = $true; result = $data.result}
        } catch {
            return @{ok = $false; code = 'NETWORK_TIMEOUT_OR_RESPONSE'}
        } finally {
            if ($response) { $response.Dispose() }
            if ($content) { $content.Dispose() }
        }
    }
    Invoke-TelegramDiagnostic $request {param($line) Write-Host $line} {
        $null = Read-Host 'Gui ma tren dien thoai XONG thi nhan Enter o day'
    }
} catch {
    Write-Host 'Khong chay duoc chan doan. Khong chia se token hoac exception chi tiet.'
} finally {
    $plainToken = $null
    if ($secureToken) { $secureToken.Dispose() }
    if ($client) { $client.Dispose() }
    if ($handler) { $handler.Dispose() }
}
