param([switch]$SelfTest, [switch]$RegisterWebhook)

# Diagnostics are read-only. Registration requires explicit -RegisterWebhook.
# No offset, pending-update deletion, or token persistence.
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

function Register-StagingWebhook {
    param([scriptblock]$Request, [scriptblock]$Emit, [string]$Secret)
    $target = 'https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/telegram'
    if ($Secret -cnotmatch '^[a-f0-9]{64}$') { & $Emit 'Secret local khong hop le. Chua thay doi webhook.'; return }
    $me = & $Request 'getMe' @{}
    if (-not $me.ok -or $me.result.username -ine 'Minh_Anh_cua_Minh_bot' -or
        [string]$me.result.id -ne '8854712189') {
        & $Emit 'Khong xac minh duoc dung bot da duyet. Chua thay doi webhook.'; return
    }
    $before = & $Request 'getWebhookInfo' @{}
    if (-not $before.ok) { & $Emit 'Khong doc duoc webhook hien tai. Chua thay doi.'; return }
    if ($before.result.url -and $before.result.url -cne $target) {
        & $Emit 'Bot dang noi voi dia chi KHAC. Dung lai de kiem tra, khong ghi de.'; return
    }
    $set = & $Request 'setWebhook' @{
        url = $target; secret_token = $Secret
        allowed_updates = @('message', 'callback_query')
        drop_pending_updates = $false; max_connections = 1
    }
    $after = & $Request 'getWebhookInfo' @{}
    if (-not $set.ok -or $set.result -ne $true) {
        & $Emit "Dang ky chua xac nhan thanh cong ($($set.code)). Khong tu thu lai; co the request da toi Telegram."
        return
    }
    if (-not $after.ok -or $after.result.url -cne $target) {
        & $Emit 'Telegram da nhan dang ky nhung chua xac minh duoc dia chi. Can kiem tra lai.'; return
    }
    & $Emit 'DA DANG KY webhook staging. Khong xoa tin dang cho.'
    & $Emit "Tin dang cho: $($after.result.pending_update_count)"
    if ($after.result.last_error_date) {
        & $Emit 'Telegram co ghi nhan loi giao tin (co the tu truoc). Can kiem tra khi gui tin moi.'
    }
    & $Emit 'Mo bot tren dien thoai va gui /tasks. AI/Calendar van tat.'
    & $Emit 'Dang ky thanh cong chua chung minh bot da tra loi; bao lai ket qua /tasks.'
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
    foreach ($scenario in @('success', 'wrongbot', 'foreignhook', 'timeout', 'badsecret', 'wrongafter')) {
        $state = @{sets = 0; reads = 0; lines = [Collections.Generic.List[string]]::new()}
        $fake = {
            param($method, $body)
            switch ($method) {
                'getMe' { return @{ok = $true; result = @{id = $(if ($scenario -eq 'wrongbot') {1} else {8854712189}); username = 'Minh_Anh_cua_Minh_bot'}} }
                'getWebhookInfo' {
                    $state.reads++
                    $url = ''
                    if ($scenario -eq 'foreignhook' -or ($scenario -eq 'wrongafter' -and $state.reads -gt 1)) { $url = 'https://other.invalid/hidden' }
                    elseif ($state.sets) { $url = 'https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/telegram' }
                    return @{ok = $true; result = @{url = $url; pending_update_count = 2}}
                }
                'setWebhook' {
                    $state.sets++
                    if ($body.drop_pending_updates -ne $false -or $body.max_connections -ne 1 -or
                        ($body.allowed_updates -join ',') -ne 'message,callback_query' -or $body.secret_token -ne ('a' * 64)) { throw 'Unsafe registration' }
                    if ($scenario -eq 'timeout') { return @{ok = $false; code = 'NETWORK_TIMEOUT_OR_RESPONSE'} }
                    return @{ok = $true; result = $true}
                }
                default { throw 'Unexpected method' }
            }
        }
        Register-StagingWebhook $fake {param($line) $state.lines.Add([string]$line)} $(if ($scenario -eq 'badsecret') {'bad'} else {'a' * 64})
        $output = $state.lines -join "`n"
        $expected = @{success = 'DA DANG KY'; wrongbot = 'dung bot'; foreignhook = 'dia chi KHAC'; timeout = 'chua xac nhan'; badsecret = 'Secret local'; wrongafter = 'chua xac minh'}[$scenario]
        if (-not $output.Contains($expected) -or $output.Contains(('a' * 64)) -or $output.Contains('other.invalid')) { throw "Registration test failed: $scenario" }
        $expectedSets = if ($scenario -in @('wrongbot', 'foreignhook', 'badsecret')) {0} else {1}
        if ($state.sets -ne $expectedSets) { throw 'Unexpected registration count' }
    }
    Write-Host 'PASS: 12 offline scenarios. No network calls.'
    return
}

$secureToken = $null
$plainToken = $null
$client = $null
$handler = $null
$webhookSecure = $null
$webhookPlain = $null
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
            if ($method -notin @('getMe', 'getWebhookInfo', 'getUpdates') -and
                -not ($RegisterWebhook -and $method -eq 'setWebhook')) { return @{ok = $false; code = 'METHOD_DENIED'} }
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
    if ($RegisterWebhook) {
        $secretPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.dev.vars.webhook-secret.dpapi'
        $cipher = (Get-Content -LiteralPath $secretPath -Raw -ErrorAction Stop).Trim()
        $webhookSecure = ConvertTo-SecureString $cipher -ErrorAction Stop
        $webhookPlain = [System.Net.NetworkCredential]::new('', $webhookSecure).Password
        Register-StagingWebhook $request {param($line) Write-Host $line} $webhookPlain
    } else {
        Invoke-TelegramDiagnostic $request {param($line) Write-Host $line} {
            $null = Read-Host 'Gui ma tren dien thoai XONG thi nhan Enter o day'
        }
    }
} catch {
    Write-Host 'Khong chay duoc chan doan. Khong chia se token hoac exception chi tiet.'
} finally {
    $plainToken = $null
    $webhookPlain = $null
    if ($webhookSecure) { $webhookSecure.Dispose() }
    if ($secureToken) { $secureToken.Dispose() }
    if ($client) { $client.Dispose() }
    if ($handler) { $handler.Dispose() }
}
