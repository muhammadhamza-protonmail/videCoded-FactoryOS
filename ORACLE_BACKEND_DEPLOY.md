# FactoryOS Backend on Oracle Cloud Free Tier

This deploys only the backend API to an Oracle Cloud Ubuntu VM. Desktop Electron can stay offline/local, and Android/mobile can use this API online.

## 1. Create VM

- Oracle Cloud Console → Compute → Instances → Create instance.
- Image: Ubuntu.
- Shape: Always Free eligible Ampere A1 or other Always Free shape available in your region.
- Save/download the SSH private key.
- Add ingress rules for TCP `22`, `80`, `443`, and `5000` while testing.

## 2. Connect

```bash
ssh -i your-key.key ubuntu@YOUR_PUBLIC_IP
```

## 3. Install server tools

```bash
sudo apt update
sudo apt install -y git curl unzip build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 4. Upload code

From your Windows project root:

```powershell
scp -i C:\path\to\your-key.key -r backend ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/factoryos-backend
```

## 5. Configure backend on VM

```bash
sudo mkdir -p /opt/factoryos/data /opt/factoryos/uploads
sudo chown -R ubuntu:ubuntu /opt/factoryos
cd /home/ubuntu/factoryos-backend
cp .env.production.example .env
nano .env
npm install --omit=dev
```

If you want to use your existing local database, upload it:

```powershell
scp -i C:\path\to\your-key.key backend\database.sqlite ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/database.sqlite
```

Then on the VM:

```bash
cp /home/ubuntu/database.sqlite /opt/factoryos/data/database.sqlite
```

## 6. Start backend

```bash
cd /home/ubuntu/factoryos-backend
pm2 start server.js --name factoryos-api
pm2 save
pm2 startup
```

Test:

```bash
curl http://localhost:5000/api/auth/me
```

From phone/app, use:

```txt
http://YOUR_PUBLIC_IP:5000/api
```

## 7. Safer production later

After testing, put Nginx + HTTPS in front of Node and use:

```txt
https://your-domain.com/api
```
