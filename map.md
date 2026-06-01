🧱 تعریف نهایی پلتفرم

پلتفرمی که باید بسازی:

یک Schema-driven, Plugin-based, Workspace-agnostic Platform
که بتواند چندین مدل کسب‌وکار (workspace) را بدون تغییر در core اجرا کند.

🧠 اصل‌های غیرقابل مذاکره (Non-Negotiables)

قبل از هر چیز، این‌ها قانون هستن:

1. Core هیچ دانشی از Denali ندارد

اگر core بداند:

step چیست در Denali
canonical shape چیست در Denali

سیستم fail است.

2. فقط یک Source of Truth وجود دارد

❗️فقط Canonical Model

RHF = فقط ابزار فرم
UI = فقط مصرف‌کننده
API = فقط مصرف‌کننده
3. Workspace = Plugin

یعنی:

اضافه کردن workspace جدید = فقط اضافه کردن یک پکیج
بدون تغییر در core
4. Renderer باید 100% coverage داشته باشد

اگر حتی یک input مستقیم در JSX بنویسی:

→ معماری ناقص است

🧩 لایه‌های سیستم (از پایین به بالا)
🗄️ 1. Data Layer (Database)
هدف:

ذخیره داده بدون وابستگی به workspace

ساختار اصلی
جدول اصلی (tours)
id
workspace_id
canonical_data (JSON)
status
created_at
چرا JSON؟

چون:

هر workspace schema خودش را دارد
structure ثابت نیست
نکته مهم

❗️Database نباید بداند Denali چیست

Index Strategy
فقط روی فیلدهای مهم index بزن
نه کل canonical

مثلاً:

destination
date
price
Template Storage

جدول templates:

id
workspace_id
template_data (canonical shape)
Draft Storage

دو حالت:

داخل همان جدول (status = draft)
جدول جدا drafts
⚙️ 2. Backend Layer
هدف:

اجرای logic بدون وابستگی به workspace خاص

2.1 Workspace Registry

سیستمی که workspaceها را ثبت می‌کند:

workspace_id
schema
validators
transformers
2.2 Request Flow

وقتی request میاد:

workspace_id خوانده می‌شود
workspace resolve می‌شود
schema مربوطه load می‌شود
validation انجام می‌شود
canonical ذخیره می‌شود
2.3 Validation

❌ اشتباه:

validateDenaliTour()

✔️ درست:

validate(workspace.schema, data)
2.4 Transformation Layer

بین canonical و database:

canonical → db format
db → canonical
2.5 Business Logic

باید generic باشد:

pricing
availability
permissions

اگر Denali-specific شد:

→ باید برود داخل plugin

2.6 API Design

همه endpointها باید workspace-aware باشند:

مثلاً:

create tour
update tour
get tour

همه باید workspace_id داشته باشند

🧠 3. Domain Layer (Core Engine)

این مهم‌ترین بخش است

3.1 Field Registry Engine

تعریف می‌کند:

چه فیلدهایی وجود دارند
کجا هستند
چه نوعی دارند
3.2 Canonical Model

یک object generic:

nested
dynamic
workspace-specific data داخلش
3.3 Rule Engine

قوانین مثل:

hide field
require field
enable/disable

باید:

pure باشند
بدون وابستگی به UI
3.4 Step Engine

تعریف می‌کند:

wizard steps
ترتیب مراحل
فیلدهای هر step
3.5 Validation Engine
بر اساس schema
workspace-specific
3.6 Renderer قرارداد (نه UI)

Core فقط contract تعریف می‌کند:

field → component key
نه اینکه React بداند
🧩 4. Workspace Plugin Layer

هر workspace یک package جداست

هر workspace باید این‌ها را داشته باشد:
1. Registry Data

لیست تمام فیلدها

2. Schema

Zod یا هر validator

3. Rules

business rules

4. Step Definition

ساختار wizard

5. Widgets

کامپوننت‌های خاص

6. Transformers

اگر نیاز به mapping خاص دارد

نکته مهم

❗️هیچ چیز shared با Denali نباید hardcoded باشد

🖥️ 5. Frontend Layer
5.1 Workspace Bootstrapping

وقتی UI load می‌شود:

workspace_id گرفته می‌شود
workspace config load می‌شود
provider ساخته می‌شود
5.2 Canonical State

فقط یک state:

canonical
5.3 Form Layer

RHF یا هر فرم:

فقط adapter
sync با canonical
5.4 Renderer Engine

برای هر field:

registry lookup
rule check
widget render
5.5 Widgets

دو نوع:

1. Generic
input
select
checkbox
2. Custom
complex UI
workspace-specific
5.6 Composite Fields (راه درست)

❌ الان:

bypass renderer

✔️ باید:

registry بتواند nested/group تعریف کند
5.7 Step Rendering

هر step:

fields.map
renderer
5.8 No Hardcoding

❌ ممنوع:

input مستقیم
path دستی
useController پراکنده
🔄 6. Data Flow (صحیح)
جریان درست
user input
update canonical
renderer re-render
submit → API
store canonical
چیزی که نباید باشد
dual write
RHF source of truth
🔌 7. Plugin Resolution
runtime چه کار می‌کند:
workspace_id می‌گیرد
plugin را load می‌کند
config را inject می‌کند
config شامل:
registry
schema
rules
widgets
steps
🚫 8. چیزهایی که باید حذف شوند
در سیستم فعلی تو:
DenaliCanonicalContext
DenaliFieldRenderer
DenaliCreateForm
DENALI_* constants
composite bypass logic
dual state
🎯 9. ویژگی‌های نهایی سیستم
وقتی درست پیاده‌سازی شود:
اضافه کردن workspace جدید:
فقط یک package جدید
بدون تغییر در core
تغییر UI:
فقط registry یا widget
تغییر schema:
فقط در plugin
تست:
هر workspace جدا تست می‌شود
🧨 10. بزرگ‌ترین ریسک‌ها (که باید حل شوند)
1. Canonical coupling

الان:

DenaliCanonicalTourModel

باید:

generic Canonical
2. Renderer ناقص

باید:

همه fieldها را پوشش دهد
3. Dual state

باید:

حذف شود
4. Composite hack

باید:

با registry حل شود
5. Backend coupling

باید:

workspace-aware شود
🧾 جمع‌بندی نهایی

تو الان داری:

یک سیستم خیلی پیشرفته
ولی تک-ورک‌اسپیسی (Denali-locked)

باید برسی به:

یک Engine عمومی (Platform)
+
چند Plugin (Workspace)

🧠 جمله‌ای که باید همیشه یادت باشه:

Platform logic = generic
Workspace logic = injectable