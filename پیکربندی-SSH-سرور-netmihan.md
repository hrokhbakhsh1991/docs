# پیکربندی SSH برای سرور Netmihan

این فایل حاوی اطلاعات و دستورالعمل اتصال به سرور شماست.

## اطلاعات سرور

- **Host**: noc.netmihan.com
- **Port**: 21
- **Username**: bFF9904
- **Password**: AFTGJvYGdeY

⚠️ **توجه مهم**: پورت 21 معمولاً برای FTP استفاده می‌شود، نه SSH. اگر این سرور واقعاً از پورت 21 برای SSH استفاده می‌کند، پیکربندی زیر صحیح است. در غیر این صورت، پورت SSH معمولاً 22 است.

---

## روش 1: پیکربندی SSH Config (توصیه می‌شود)

### مرحله 1: باز کردن فایل SSH Config

در VSCode:
1. `Ctrl+Shift+P` (یا `Cmd+Shift+P` در macOS)
2. تایپ کنید: `Remote-SSH: Open SSH Configuration File`
3. فایل `~/.ssh/config` را انتخاب کنید

### مرحله 2: اضافه کردن پیکربندی

محتوای زیر را به فایل config اضافه کنید:

```ssh-config
Host netmihan-server
    HostName noc.netmihan.com
    User bFF9904
    Port 21
```

**توضیح:**
- `Host netmihan-server` - نام دلخواه برای شناسایی سرور در VSCode
- `HostName noc.netmihan.com` - آدرس سرور
- `User bFF9904` - نام کاربری شما
- `Port 21` - پورت اتصال

### مرحله 3: ذخیره فایل

فایل config را ذخیره کنید (`Ctrl+S` یا `Cmd+S`)

---

## روش 2: اتصال مستقیم (بدون config)

### از طریق VSCode:

1. `Ctrl+Shift+P` (یا `Cmd+Shift+P`)
2. تایپ کنید: `Remote-SSH: Connect to Host`
3. گزینه `Add New SSH Host...` را انتخاب کنید
4. دستور زیر را وارد کنید:

```bash
ssh bFF9904@noc.netmihan.com -p 21
```

5. فایل config را برای ذخیره انتخاب کنید
6. سپس دوباره `Connect to Host` را انتخاب کنید
7. `netmihan-server` یا `noc.netmihan.com` را انتخاب کنید

---

## اتصال به سرور

### مرحله 1: اتصال

1. در VSCode، `Ctrl+Shift+P` را بزنید
2. `Remote-SSH: Connect to Host` را انتخاب کنید
3. `netmihan-server` را از لیست انتخاب کنید

### مرحله 2: وارد کردن رمز عبور

وقتی VSCode درخواست کرد، رمز عبور زیر را وارد کنید:

```
AFTGJvYGdeY
```

### مرحله 3: انتظار برای اتصال

VSCode به سرور متصل می‌شود و یک پنجره جدید باز می‌کند.

---

## تست اتصال از ترمینال

قبل از استفاده در VSCode، می‌توانید اتصال را از ترمینال تست کنید:

```bash
ssh bFF9904@noc.netmihan.com -p 21
```

سپس رمز عبور `AFTGJvYGdeY` را وارد کنید.

---

## رفع مشکلات احتمالی

### مشکل 1: "Connection refused" یا "Connection timeout"

**احتمال 1**: پورت اشتباه است
- پورت 21 معمولاً برای FTP است
- پورت SSH معمولاً 22 است
- با مدیر سرور تماس بگیرید و پورت صحیح SSH را بپرسید

**احتمال 2**: فایروال اتصال را مسدود کرده
- مطمئن شوید که فایروال شما اجازه اتصال به پورت 21 را می‌دهد

### مشکل 2: "Permission denied"

**راه‌حل:**
- مطمئن شوید نام کاربری و رمز عبور صحیح است
- نام کاربری: `bFF9904`
- رمز عبور: `AFTGJvYGdeY`

### مشکل 3: "Host key verification failed"

**راه‌حل:**
```bash
ssh-keygen -R noc.netmihan.com
```

سپس دوباره اتصال را امتحان کنید.

---

## نکات امنیتی

### 1. استفاده از SSH Key (توصیه می‌شود)

برای امنیت بیشتر، از SSH Key استفاده کنید:

```bash
# ایجاد SSH Key
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# کپی کلید به سرور
ssh-copy-id -p 21 bFF9904@noc.netmihan.com
```

سپس config را به این صورت تغییر دهید:

```ssh-config
Host netmihan-server
    HostName noc.netmihan.com
    User bFF9904
    Port 21
    IdentityFile ~/.ssh/id_rsa
```

### 2. تغییر رمز عبور

پس از اولین اتصال، رمز عبور خود را تغییر دهید:

```bash
passwd
```

### 3. حذف این فایل پس از پیکربندی

⚠️ **مهم**: این فایل حاوی رمز عبور شماست. پس از پیکربندی موفق، آن را حذف کنید یا رمز عبور را از آن پاک کنید.

---

## دستورات مفید پس از اتصال

### بررسی دایرکتوری فعلی
```bash
pwd
```

### لیست فایل‌ها
```bash
ls -la
```

### بررسی فضای دیسک
```bash
df -h
```

### بررسی حافظه
```bash
free -h
```

---

## پشتیبانی

اگر با مشکلی مواجه شدید:

1. **بررسی لاگ‌های VSCode:**
   - `View` → `Output`
   - از dropdown، `Remote - SSH` را انتخاب کنید

2. **تست از ترمینال:**
   ```bash
   ssh -v bFF9904@noc.netmihan.com -p 21
   ```

3. **تماس با پشتیبانی Netmihan:**
   - وب‌سایت: mihanwebhost.com
   - مستندات: http://my.mihanwebhost.com/knowledgebase.php

---

## خلاصه مراحل

1. ✅ نصب Remote-SSH extension در VSCode
2. ✅ باز کردن SSH Config: `Ctrl+Shift+P` → `Remote-SSH: Open SSH Configuration File`
3. ✅ اضافه کردن پیکربندی بالا به فایل config
4. ✅ ذخیره فایل config
5. ✅ اتصال: `Ctrl+Shift+P` → `Remote-SSH: Connect to Host` → `netmihan-server`
6. ✅ وارد کردن رمز عبور: `AFTGJvYGdeY`
7. ✅ شروع کار با سرور!

موفق باشید! 🚀
