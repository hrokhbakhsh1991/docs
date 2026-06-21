# دستورات اتصال SSH به سرور Netmihan

## مرحله 1: اضافه کردن پیکربندی به SSH Config

فایل `~/.ssh/config` را باز کنید و این خطوط را به انتهای آن اضافه کنید:

```ssh-config
Host netmihan-server
    HostName noc.netmihan.com
    User bFF9904
    Port 21
```

**در VSCode:**
- فایل `~/.ssh/config` را که الان باز است ویرایش کنید
- خطوط بالا را کپی کرده و به انتهای فایل اضافه کنید
- فایل را ذخیره کنید (`Ctrl+S`)

---

## مرحله 2: اتصال از طریق VSCode

1. کلیدهای `Ctrl+Shift+P` را بزنید
2. تایپ کنید: `Remote-SSH: Connect to Host`
3. از لیست، `netmihan-server` را انتخاب کنید
4. رمز عبور را وارد کنید: `AFTGJvYGdeY`
5. منتظر بمانید تا VSCode به سرور متصل شود

---

## مرحله 3: تست اتصال از ترمینال (اختیاری)

اگر می‌خواهید ابتدا از ترمینال تست کنید:

```bash
ssh bFF9904@noc.netmihan.com -p 21
```

سپس رمز عبور را وارد کنید: `AFTGJvYGdeY`

---

## اگر پورت 21 کار نکرد

احتمالاً پورت SSH سرور شما 22 است (پورت 21 معمولاً برای FTP است).

در این صورت، در فایل `~/.ssh/config` پورت را تغییر دهید:

```ssh-config
Host netmihan-server
    HostName noc.netmihan.com
    User bFF9904
    Port 22
```

یا از ترمینال امتحان کنید:

```bash
ssh bFF9904@noc.netmihan.com -p 22
```

---

## خلاصه دستورات

### تست اتصال:
```bash
ssh bFF9904@noc.netmihan.com -p 21
```

### اگر پورت 21 کار نکرد:
```bash
ssh bFF9904@noc.netmihan.com -p 22
```

### بررسی پورت‌های باز سرور:
```bash
nmap -p 21,22 noc.netmihan.com
```

### اتصال با verbose (برای دیدن جزئیات خطا):
```bash
ssh -v bFF9904@noc.netmihan.com -p 21
```

---

## رمز عبور

```
AFTGJvYGdeY
```

⚠️ **این فایل را پس از اتصال موفق حذف کنید!**
