# Read the current index.json
$indexPath = "public\songs\index.json"
$json = Get-Content $indexPath -Raw | ConvertFrom-Json

# Create new song entry
$newSong = @{
    id = "Onthefloor"
    title = "On the floor"
    artist = "hour"
    video = "onthefloor.mp4"
    language = @("Khmer")
    bpm = 120
    gap = 0
    year = "2024"
    volume = 1
    author = "4T5"
    tracks = @(@{ start = 0 })
    shortId = 5036
    tracksCount = 1
    search = "onthefloor"
    local = $true
}

# Add to array
$json += $newSong

# Save back
$json | ConvertTo-Json -Depth 10 | Set-Content $indexPath -Encoding UTF8
Write-Host "Done! Song added to index.json"