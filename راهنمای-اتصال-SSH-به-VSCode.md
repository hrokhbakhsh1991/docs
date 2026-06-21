# راهنمای کامل اتصال SSH به سرور در VSCode

این راهنما شما را گام به گام در فرآیند اتصال به یک سرور از طریق SSH در Visual Studio Code همراهی می‌کند.

## فهرست مطالب
1. [پیش‌نیازها](#پیش-نیازها)
2. [نصب Remote-SSH Extension](#نصب-remote-ssh-extension)
3. [پیکربندی SSH Config](#پیکربندی-ssh-config)
4. [اتصال به سرور](#اتصال-به-سرور)
5. [استفاده از SSH Key](#استفاده-از-ssh-key)
6. [نکات امنیتی](#نکات-امنیتی)
7. [رفع مشکلات رایج](#رفع-مشکلات-رایج)

---

## پیش‌نیازها

قبل از شروع، مطمئن شوید که موارد زیر را دارید:

- ✅ Visual Studio Code نصب شده باشد
- ✅ دسترسی SSH به سرور (IP، نام کاربری، و رمز عبور یا SSH key)
- ✅ OpenSSH client روی سیستم شما نصب باشد

### بررسی نصب OpenSSH

در ترمینال دستور زیر را اجرا کنید:

```bash
ssh -V
```

اگر خروجی مشابه `OpenSSH_8.x` دیدید، OpenSSH نصب است.

---

## نصب Remote-SSH Extension

### مرحله 1: باز کردن Extensions Panel

1. VSCode را باز کنید
2. از منوی سمت چپ، روی آیکون Extensions کلیک کنید (یا `Ctrl+Shift+X` در Linux/Windows یا `Cmd+Shift+X` در macOS)

### مرحله 2: جستجو و نصب

1. در کادر جستجو، `Remote - SSH` را تایپ کنید
2. Extension با نام **"Remote - SSH"** از Microsoft را پیدا کنید
3. روی دکمه **Install** کلیک کنید

### مرحله 3: تأیید نصب

پس از نصب، یک آیکون جدید در گوشه پایین سمت چپ VSCode ظاهر می‌شود (شبیه `><`)

---

## پیکربندی SSH Config

### روش 1: استفاده از Command Palette (توصیه می‌شود)

1. Command Palette را باز کنید:
   - Linux/Windows: `Ctrl+Shift+P`
   - macOS: `Cmd+Shift+P`

2. تایپ کنید: `Remote-SSH: Open SSH Configuration File`

3. فایل config را انتخاب کنید (معمولاً `~/.ssh/config`)

4. پیکربندی سرور خود را اضافه کنید:

```ssh-config
Host my-server
    HostName 192.168.1.100
    User username
    Port 22
    IdentityFile ~/.ssh/id_rsa
```

**توضیح پارامترها:**
- `Host`: نام دلخواه برای سرور (برای شناسایی آسان)
- `HostName`: آدرس IP یا دامنه سرور
- `User`: نام کاربری SSH
- `Port`: پورت SSH (پیش‌فرض: 22)
- `IdentityFile`: مسیر کلید خصوصی SSH (اختیاری)

### روش 2: ویرایش دستی فایل config

فایل `~/.ssh/config` را با یک ویرایشگر متن باز کنید:

```bash
# در Linux/macOS
nano ~/.ssh/config

# یا
vim ~/.ssh/config
```

در Windows:
```powershell
notepad C:\Users\YourUsername\.ssh\config
```

### مثال‌های پیکربندی

#### سرور ساده با رمز عبور:
```ssh-config
Host production-server
    HostName example.com
    User admin
    Port 22
```

#### سرور با SSH Key:
```ssh-config
Host dev-server
    HostName dev.example.com
    User developer
    Port 2222
    IdentityFile ~/.ssh/dev_key
    ForwardAgent yes
```

#### چند سرور:
```ssh-config
Host server1
    HostName 192.168.1.10
    User root
    Port 22

Host server2
    HostName 192.168.1.20
    User admin
    Port 2222
    IdentityFile ~/.ssh/server2_key
```

---

## اتصال به سرور

### روش 1: از طریق Command Palette

1. Command Palette را باز کنید (`Ctrl+Shift+P` یا `Cmd+Shift+P`)
2. تایپ کنید: `Remote-SSH: Connect to Host`
3. سرور مورد نظر را از لیست انتخاب کنید
4. در صورت درخواست، رمز عبور را وارد کنید
5. منتظر بمانید تا VSCode به سرور متصل شود

### روش 2: از طریق آیکون Remote

1. روی آیکون `><` در گوشه پایین سمت چپ کلیک کنید
2. گزینه **"Connect to Host..."** را انتخاب کنید
3. سرور مورد نظر را انتخاب کنید

### روش 3: اتصال سریع (بدون config)

1. Command Palette → `Remote-SSH: Connect to Host`
2. گزینه **"Add New SSH Host..."** را انتخاب کنید
3. دستور SSH را وارد کنید:
   ```
   ssh username@hostname -p port
   ```
4. فایل config برای ذخیره را انتخاب کنید

---

## استفاده از SSH Key

استفاده از SSH Key امن‌تر از رمز عبور است و نیازی به وارد کردن رمز در هر اتصال ندارد.

### مرحله 1: ایجاد SSH Key (اگر ندارید)

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

- Enter را بزنید تا در مسیر پیش‌فرض ذخیره شود (`~/.ssh/id_rsa`)
- یک passphrase قوی وارد کنید (اختیاری اما توصیه می‌شود)

### مرحله 2: کپی کلید عمومی به سرور

```bash
ssh-copy-id username@hostname
```

یا به صورت دستی:

```bash
cat ~/.ssh/id_rsa.pub | ssh username@hostname "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### مرحله 3: تست اتصال

```bash
ssh username@hostname
```

اگر بدون درخواست رمز عبور وارد شدید، SSH Key به درستی پیکربندی شده است.

### مرحله 4: استفاده در VSCode

در فایل `~/.ssh/config`:

```ssh-config
Host my-server
    HostName example.com
    User username
    IdentityFile ~/.ssh/id_rsa
```

---

## نکات امنیتی

### 1. استفاده از SSH Key به جای رمز عبور
✅ همیشه از SSH Key استفاده کنید
✅ از passphrase برای کلیدهای خصوصی استفاده کنید

### 2. تغییر پورت پیش‌فرض SSH
```ssh-config
Host my-server
    HostName example.com
    User username
    Port 2222  # به جای 22
```

### 3. غیرفعال کردن ورود root
در سرور، فایل `/etc/ssh/sshd_config` را ویرایش کنید:
```
PermitRootLogin no
```

### 4. محدود کردن دسترسی به IP خاص
```ssh-config
Host my-server
    HostName example.com
    User username
    # فقط از شبکه خاصی اتصال برقرار کن
```

### 5. استفاده از SSH Agent
```bash
# شروع ssh-agent
eval "$(ssh-agent -s)"

# اضافه کردن کلید
ssh-add ~/.ssh/id_rsa
```

در config:
```ssh-config
Host my-server
    HostName example.com
    User username
    ForwardAgent yes
```

---

## رفع مشکلات رایج

### مشکل 1: "Permission denied (publickey)"

**علت:** کلید SSH به درستی پیکربندی نشده است.

**راه‌حل:**
```bash
# بررسی مجوزها
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# مطمئن شوید کلید عمومی در سرور است
ssh-copy-id username@hostname
```

### مشکل 2: "Connection timeout"

**علت:** سرور در دسترس نیست یا فایروال اتصال را مسدود کرده است.

**راه‌حل:**
```bash
# تست اتصال
ping hostname

# بررسی پورت SSH
telnet hostname 22

# یا
nc -zv hostname 22
```

### مشکل 3: "Host key verification failed"

**علت:** کلید میزبان سرور تغییر کرده است.

**راه‌حل:**
```bash
# حذف کلید قدیمی
ssh-keygen -R hostname

# یا ویرایش دستی
nano ~/.ssh/known_hosts
```

### مشکل 4: VSCode نمی‌تواند به سرور متصل شود

**راه‌حل:**
1. مطمئن شوید از ترمینال می‌توانید متصل شوید:
   ```bash
   ssh username@hostname
   ```

2. لاگ‌های VSCode را بررسی کنید:
   - `View` → `Output`
   - از dropdown، `Remote - SSH` را انتخاب کنید

3. Remote-SSH extension را دوباره نصب کنید

4. VSCode را restart کنید

### مشکل 5: "Could not establish connection to server"

**راه‌حل:**
```bash
# پاک کردن کش VSCode Remote
rm -rf ~/.vscode-server

# در Windows:
# rmdir /s %USERPROFILE%\.vscode-server
```

### مشکل 6: اتصال کند است

**راه‌حل:**
در `~/.ssh/config` اضافه کنید:
```ssh-config
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
    TCPKeepAlive yes
```

---

## نکات پیشرفته

### 1. استفاده از Jump Host (Bastion)

```ssh-config
Host bastion
    HostName bastion.example.com
    User admin

Host internal-server
    HostName 10.0.0.5
    User developer
    ProxyJump bastion
```

### 2. استفاده از SSH Config برای چند محیط

```ssh-config
# Development
Host dev
    HostName dev.example.com
    User developer
    IdentityFile ~/.ssh/dev_key

# Staging
Host staging
    HostName staging.example.com
    User deployer
    IdentityFile ~/.ssh/staging_key

# Production
Host prod
    HostName prod.example.com
    User admin
    IdentityFile ~/.ssh/prod_key
```

### 3. Port Forwarding

```ssh-config
Host my-server
    HostName example.com
    User username
    LocalForward 3000 localhost:3000
    LocalForward 5432 localhost:5432
```

### 4. استفاده از Multiplexing برای اتصالات سریع‌تر

```ssh-config
Host *
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 600
```

---

## دستورات مفید

### بررسی وضعیت اتصال
```bash
# لیست اتصالات فعال
ps aux | grep ssh

# بررسی پورت‌های باز
netstat -an | grep :22
```

### مدیریت کلیدها
```bash
# لیست کلیدهای اضافه شده به agent
ssh-add -l

# حذف همه کلیدها از agent
ssh-add -D

# اضافه کردن کلید با timeout
ssh-add -t 3600 ~/.ssh/id_rsa
```

### Debug اتصال SSH
```bash
# اتصال با verbose mode
ssh -v username@hostname

# سطح بالاتر debug
ssh -vvv username@hostname
```

---

## منابع بیشتر

- [مستندات رسمی Remote-SSH](https://code.visualstudio.com/docs/remote/ssh)
- [راهنمای SSH Config](https://www.ssh.com/academy/ssh/config)
- [بهترین شیوه‌های امنیتی SSH](https://www.ssh.com/academy/ssh/security)

---

## خلاصه

1. ✅ نصب Remote-SSH extension
2. ✅ پیکربندی `~/.ssh/config`
3. ✅ اتصال از طریق Command Palette
4. ✅ استفاده از SSH Key برای امنیت بیشتر
5. ✅ رفع مشکلات رایج

**نکته مهم:** همیشه از SSH Key استفاده کنید و رمزهای عبور قوی انتخاب کنید!

---

## پشتیبانی

اگر با مشکلی مواجه شدید که در این راهنما پوشش داده نشده، می‌توانید:
- Issue در GitHub پروژه Remote-SSH باز کنید
- در Stack Overflow جستجو کنید
- مستندات رسمی VSCode را مطالعه کنید

موفق باشید! 🚀
