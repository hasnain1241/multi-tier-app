# Market Community Place - Multi-Tier App Deployment

A community marketplace web application deployed via a fully automated GitOps pipeline on AWS using Docker, Terraform, Ansible, Kubernetes (microk8s), GitHub Actions, and ArgoCD.

---

## Application

**Market Community Place** is a full-stack marketplace where users can:
- Browse listings across categories (Electronics, Sports, Books, Furniture, Clothing, Other)
- Filter by category
- Post new listings with title, price, category, seller name, and description

The frontend (Nginx) proxies all `/api/` requests to the backend (Node.js/Express) internally within the Kubernetes cluster - no hardcoded IPs or CORS issues.

---

## Architecture

```
Code Push
    │
    ▼
GitHub Actions CI
    │  builds Docker images
    │  pushes to DockerHub
    │  updates K8s manifests with new image tags
    ▼
ArgoCD (GitOps)
    │  detects manifest changes
    │  auto-syncs to cluster
    ▼
microk8s (Kubernetes on EC2)
    │
    ├── Frontend (Nginx :30080)  ──proxy /api/──► Backend (Node.js :30001)
    └── Backend (Node.js :30001)
```

### Technology Stack
| Layer | Technology |
|---|---|
| Frontend | Nginx serving static HTML, proxies /api/ to backend |
| Backend | Node.js + Express REST API |
| Containerization | Docker |
| Infrastructure | AWS EC2 (t2.medium), VPC, Security Groups |
| IaC | Terraform |
| Configuration Management | Ansible |
| Kubernetes | microk8s (single-node) |
| CI Pipeline | GitHub Actions |
| CD / GitOps | ArgoCD |

---

## Project Structure

```
multi-tier-app/
├── backend/
│   ├── server.js               # Express API (listings, categories, health)
│   ├── package.json
│   └── Dockerfile              # node:18-alpine
├── frontend/
│   ├── src/index.html          # Marketplace UI
│   ├── nginx.conf              # Nginx with /api/ proxy to backend-service
│   └── Dockerfile              # nginx:alpine
├── terraform/
│   ├── main.tf                 # VPC, Subnet, SG, EC2
│   ├── variables.tf
│   └── outputs.tf
├── ansible/
│   ├── inventory.ini           # EC2 target host
│   └── playbook.yml            # Install Docker, microk8s, ArgoCD
├── k8s/
│   ├── backend-deployment.yml  # 2 replicas
│   ├── backend-service.yml     # NodePort 30001
│   ├── frontend-deployment.yml # 2 replicas
│   └── frontend-service.yml    # NodePort 30080
├── .github/
│   └── workflows/
│       └── ci.yml              # CI pipeline
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/categories | List all categories |
| GET | /api/listings | All listings (optional ?category=X filter) |
| POST | /api/listings | Create a new listing |

**POST /api/listings body:**
```json
{
  "title": "Item Name",
  "price": 50,
  "category": "Electronics",
  "seller": "Your Name",
  "description": "Optional description"
}
```

---

## Prerequisites

Install on your local machine (Ubuntu/WSL):

```bash
# Git
sudo apt-get update && sudo apt-get install git -y
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# Docker
sudo apt-get install docker.io -y
sudo usermod -aG docker $USER
newgrp docker

# Terraform
sudo apt-get install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt-get install terraform -y

# Ansible
sudo apt install -y ansible

# AWS CLI
sudo apt-get install awscli -y
aws configure   # Enter Access Key, Secret Key, region: us-east-1, output: json
```

You also need:
- AWS Account with IAM user (programmatic access)
- GitHub Account with a Personal Access Token (PAT) for pushing
- DockerHub Account

---

## Phase 1 - Create EC2 Key Pair

1. Go to AWS Console → EC2 → Key Pairs → Create key pair
2. Name: `project3-key`, Type: RSA, Format: `.pem`
3. Save the `.pem` file and copy it to WSL home:

```bash
cp /mnt/c/Users/<YourUser>/Downloads/project3-key.pem ~/project3-key.pem
chmod 400 ~/project3-key.pem
```

---

## Phase 2 - Clone Repository

```bash
git clone https://github.com/YOUR-USERNAME/multi-tier-app.git
cd multi-tier-app
```

---

## Phase 3 - Provision Infrastructure with Terraform

```bash
cd terraform
terraform init
terraform plan
terraform apply    # type 'yes' when prompted
terraform output instance_public_ip   # save this IP
cd ..
```

Terraform creates:
- Custom VPC (`10.0.0.0/16`) with internet gateway and public subnet
- Security group (ports 22, 80, 3001, 30000-32767)
- EC2 instance (t2.medium, Ubuntu 22.04, 30GB gp3)

---

## Phase 4 - Configure EC2 with Ansible

Update `ansible/inventory.ini` with your EC2 IP:

```ini
[app_servers]
<EC2_IP> ansible_user=ubuntu ansible_ssh_private_key_file=~/project3-key.pem ansible_ssh_common_args='-o StrictHostKeyChecking=no'
```

Wait 2-3 minutes after Terraform finishes, then run **from the project root**:

```bash
ansible -i ansible/inventory.ini app_servers -m ping
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml
```

The playbook installs: Docker, microk8s (1.28/stable), ArgoCD, and enables DNS/Storage/Ingress addons.

---

## Phase 5 - Build and Push Docker Images (CI)

### Set GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions:

| Secret Name | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your DockerHub username |
| `DOCKERHUB_TOKEN` | DockerHub access token |

### Push to trigger CI

```bash
git add .
git commit -m "feat: initial project setup"
git push origin main
```

GitHub Actions will automatically:
1. Build backend Docker image → push to DockerHub
2. Build frontend Docker image → push to DockerHub
3. Update image tags in `k8s/` manifests → commit back to repo

**Note:** If push is rejected (remote has diverged due to CI commits), run:
```bash
git pull --rebase origin main
git push origin main
```

---

## Phase 6 - Configure ArgoCD

SSH into EC2:

```bash
ssh -i ~/project3-key.pem ubuntu@<EC2_IP>
```

Wait for all ArgoCD pods to be Running:

```bash
microk8s kubectl get pods -n argocd
```

Get the admin password:

```bash
microk8s kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Verify ArgoCD service is NodePort (Ansible sets this automatically):

```bash
microk8s kubectl get svc argocd-server -n argocd
```

If TYPE shows ClusterIP, patch it manually:

```bash
microk8s kubectl patch svc argocd-server -n argocd -p '{"spec":{"type":"NodePort"}}'
```

Access ArgoCD UI: `https://<EC2_IP>:<NODEPORT>`
- Username: `admin`
- Password: from command above

### Create ArgoCD Application

In ArgoCD UI → New App:

| Field | Value |
|---|---|
| Application Name | `multi-tier-app` |
| Project | `default` |
| Sync Policy | `Automatic` |
| Prune Resources | ✓ |
| Self Heal | ✓ |
| Repository URL | `https://github.com/YOUR-USERNAME/multi-tier-app.git` |
| Revision | `HEAD` |
| Path | `k8s` |
| Cluster URL | `https://kubernetes.default.svc` |
| Namespace | `default` |

Click **Create** - ArgoCD will sync and deploy all K8s manifests automatically.

---

## Phase 7 - Verify Deployment

SSH into EC2 and check:

```bash
microk8s kubectl get pods         # all 4 pods Running
microk8s kubectl get services     # frontend:30080, backend:30001
microk8s kubectl get deployments  # 2/2 READY for both
```

Access in browser:
- **Frontend (Marketplace UI):** `http://<EC2_IP>:30080`
- **Backend health check:** `http://<EC2_IP>:30001/api/health`

Expected backend response:
```json
{"status":"OK","message":"Market Community Place API running!"}
```

The frontend fetches categories and listings from the backend via nginx proxy (no external IP needed in the browser).

---

## Phase 8 - Test Full CI/CD Pipeline

Make a code change and push:

```bash
# Example: add a new sample listing to backend/server.js
git add backend/server.js
git commit -m "feat: add new sample listing"
git push origin main
```

Watch the pipeline:
1. GitHub Actions builds new Docker images (3-5 min)
2. Manifests updated with new image tags → committed back to repo
3. ArgoCD detects the manifest change and auto-deploys
4. New pods replace old ones - zero downtime rolling update

---

## Port Reference

| Service | Port |
|---|---|
| Frontend (Marketplace UI) | 30080 |
| Backend API | 30001 |
| ArgoCD UI | NodePort (varies, check `kubectl get svc argocd-server -n argocd`) |
| SSH | 22 |

---

## Cleanup (After Grading Only)

```bash
cd terraform
terraform destroy    # type 'yes' when prompted
```

This permanently deletes the EC2 instance and all AWS resources.
