# דיפלוי ל-Cloud Run מ-Windows (דורש gcloud מותקן ומחובר).
# הרצה מתוך liftygo-drive-api:  .\deploy.ps1

$ErrorActionPreference = "Stop"

$Region = if ($env:REGION) { $env:REGION } else { "europe-west1" }
$Service = if ($env:SERVICE) { $env:SERVICE } else { "liftygo-drive-api" }
$Project = if ($env:GCP_PROJECT) { $env:GCP_PROJECT } else {
  (gcloud config get-value project 2>$null).Trim()
}

if ([string]::IsNullOrWhiteSpace($Project)) {
  Write-Error "Set project: gcloud config set project YOUR_PROJECT_ID"
}

Write-Host "Deploying $Service to $Region (project: $Project)"

gcloud run deploy $Service `
  --source . `
  --region $Region `
  --project $Project `
  --allow-unauthenticated

$Url = gcloud run services describe $Service --region $Region --project $Project --format "value(status.url)"
Write-Host "Service URL: $Url"
Write-Host "Health: $Url/health"
