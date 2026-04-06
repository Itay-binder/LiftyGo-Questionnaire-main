#!/usr/bin/env bash
# דיפלוי ל-Google Cloud Run מתוך תיקייה זו (Cloud Shell או מכונה עם gcloud).
# שימוש: chmod +x deploy.sh && ./deploy.sh

set -euo pipefail

REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-liftygo-drive-api}"
PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "Set project: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Deploying ${SERVICE} to ${REGION} (project: ${PROJECT})"

gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --allow-unauthenticated

echo "Done. URL:"
gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT}" \
  --format 'value(status.url)'

cat <<'NOTE'

משתני סביבה נדרשים לשרת (אחרי דיפלוי ראשון או בעדכון):
  GOOGLE_SERVICE_ACCOUNT_JSON  — JSON מלא של service account (מומלץ Secret Manager)
  DRIVE_PARENT_FOLDER_ID       — תיקיית אב ב-Drive
  ALLOWED_ORIGINS              — מקורות CORS מופרדים בפסיק, למשל https://yourdomain.com
  UPLOAD_API_KEY               — אופציונלי; אם מוגדר, הלקוח חייב לשלוח כותרת x-api-key

דוגמה לעדכון (בלי JSON ארוך בשורת פקודה — העדף Secret):
  gcloud run services update liftygo-drive-api --region europe-west1 \
    --set-env-vars "DRIVE_PARENT_FOLDER_ID=...,ALLOWED_ORIGINS=https://..."

בדיקה: curl -sS "$(gcloud run services describe liftygo-drive-api --region europe-west1 --format='value(status.url)')/health"
NOTE
