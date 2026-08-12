# Carrier GreenON

Carrier 에어컨 사용자를 위한 ESG 친환경 냉방 미션 및 리워드 웹앱입니다. 실제 에어컨 API 대신 가상 IoT 데이터를 사용하며, Supabase Auth와 RLS로 사용자별 데이터를 분리합니다.

## 주요 기능

- 현재 날씨와 가상 Carrier 에어컨 상태
- 26°C 친환경 냉방 미션과 30분 단위 시뮬레이션
- GREEN POINT 적립, 지갑, 거래 기록
- FOOD·LIFE·CARRIER 리워드 상품 구매
- GREEN LEVEL 및 GREEN REPORT
- Supabase 이메일 인증과 사용자 소유권 기반 RLS

## 로컬 실행

Node.js LTS가 필요합니다.

```powershell
Copy-Item .env.example .env.local
npm.cmd ci
npm.cmd run dev
```

`.env.local`에 다음 값을 입력합니다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

브라우저 앱에는 Supabase publishable key만 사용합니다. `service_role`, secret key, 데이터베이스 비밀번호를 `VITE_` 환경변수나 소스코드에 넣으면 안 됩니다.

## 검증

```powershell
npm.cmd run build
npm.cmd audit
```

Supabase 공개 데이터와 익명 접근 차단을 확인하려면 환경변수를 설정한 터미널에서 실행합니다.

```powershell
node scripts/verify-supabase.mjs
```

## Render 배포 준비

저장소의 `render.yaml`은 Render Static Site를 다음과 같이 구성합니다.

- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Render Dashboard에서 두 환경변수를 등록한 뒤 배포합니다. Vite의 `VITE_` 값은 빌드 결과에 포함되므로 공개 가능한 Supabase URL과 publishable key만 사용해야 합니다.

배포 URL이 정해지면 Supabase Dashboard의 Authentication URL Configuration에서 Site URL과 Redirect URL을 해당 HTTPS 주소로 등록해야 이메일 인증 후 앱으로 돌아올 수 있습니다.

## 데이터 보안

- 모든 public 테이블에 RLS 적용
- 사용자 데이터는 `auth.uid()` 소유권 조건으로 격리
- 포인트 지급과 구매는 DB 함수에서 재검사 후 원자적으로 처리
- 포인트 및 주문 원장은 브라우저에서 직접 변경 불가
- 실제 Carrier API 및 관리자 비밀키 미사용

