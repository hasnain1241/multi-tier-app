# Multi-Tier Application Deployment

Automated deployment pipeline for a multi-tier microservices application using Docker, Terraform, Ansible, Kubernetes (microk8s), GitHub Actions, and ArgoCD on AWS EC2.

---

## Architecture

```
Code Push
    │
    ▼
GitHub Actions CI
    │  builds Docker images
    │  pushes to DockerHub
    │  updates K8s manifests
    ▼
ArgoCD (GitOps)
    │  detects manifest changes
    │  auto-syncs to cluster
    ▼
microk8s (Kubernetes on EC2)
    │
    ├── Frontend (Nginx)   → NodePort 30080
    └── Backend (Node.js)  → NodePort 30001
```

### Technology Stack
| Layer | Technology |
|---|---|
| Frontend | Nginx serving static HTML |
| Backend | Node.js + Express API |
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
│   ├── server.js               # Express API
│   ├── package.json
│   └── Dockerfile              # node:18-alpine
├── frontend/
│   ├── src/index.html          # Frontend page
│   ├── nginx.conf              # Nginx config
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

## Prerequisites

Install the following tools on your local machine (Ubuntu/WSL):

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
- GitHub Account
- DockerHub Account

---

## Phase 1 — Create EC2 Key Pair

1. Go to AWS Console → EC2 → Key Pairs → Create key pair
2. Name: `project3-key`, Type: RSA, Format: `.pem`
3. Save the `.pem` file and set permissions:

```bash
chmod 400 ~/project3-key.pem
```

---

## Phase 2 — Clone Repository and Create Structure

```bash
git clone https://github.com/YOUR-USERNAME/multi-tier-app.git
cd multi-tier-app
mkdir -p frontend/src backend terraform ansible k8s .github/workflows
```

---

## Phase 3 — Provision Infrastructure with Terraform

```bash
cd terraform
terraform init
terraform plan
terraform apply    # type 'yes' when prompted
terraform output instance_public_ip   # save this IP
cd ..
```

Terraform creates:
- Custom VPC (`10.0.0.0/16`)
- Public subnet with internet gateway
- Security group (ports 22, 80, 3001, 30000-32767)
- EC2 instance (t2.medium, Ubuntu 22.04, 30GB gp3)

---

## Phase 4 — Configure EC2 with Ansible

Update `ansible/inventory.ini` with your EC2 IP:

```ini
[app_servers]
<EC2_IP> ansible_user=ubuntu ansible_ssh_private_key_file=~/project3-key.pem ansible_ssh_common_args='-o StrictHostKeyChecking=no'
```

Wait 2-3 minutes after Terraform finishes, then run:

```bash
# Test connectivity
ansible -i ansible/inventory.ini app_servers -m ping

# Run full playbook
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml
```

The playbook installs: Docker, microk8s (1.28/stable), ArgoCD, and enables DNS/Storage/Ingress addons.

---

## Phase 5 — Build and Push Docker Images (CI)

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

---

## Phase 6 — Configure ArgoCD

SSH into EC2:

```bash
ssh -i ~/project3-key.pem ubuntu@<EC2_IP>
```

Wait for ArgoCD pods to be ready:

```bash
microk8s kubectl get pods -n argocd
```

Get the admin password:

```bash
microk8s kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Patch service to NodePort (if not already):

```bash
microk8s kubectl patch svc argocd-server -n argocd -p '{"spec":{"type":"NodePort"}}'
microk8s kubectl get svc argocd-server -n argocd   # note the NodePort
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

Click **Create** — ArgoCD will sync and deploy all K8s manifests automatically.

---

## Phase 7 — Verify Deployment

SSH into EC2 and check:

```bash
microk8s kubectl get pods         # all 4 pods Running
microk8s kubectl get services     # frontend:30080, backend:30001
microk8s kubectl get deployments  # 2/2 READY for both
```

Access in browser:
- **Frontend:** `http://<EC2_IP>:30080`
- **Backend:** `http://<EC2_IP>:30001/api/health`

Expected backend response:
```json
{"status":"OK","message":"Backend is running!"}
```

---

## Phase 8 — Test Full CI/CD Pipeline

Make a code change and push:

```bash
sed -i "s/Backend is running!/Backend v2 is running!/" backend/server.js
git add backend/server.js
git commit -m "feat: update backend message to v2"
git push origin main
```

Watch the pipeline:
1. GitHub Actions builds new Docker image (3-5 min)
2. Manifest updated with new image tag
3. ArgoCD detects change and auto-deploys
4. Refresh `http://<EC2_IP>:30001/api/health` → shows `Backend v2 is running!`

---

## Port Reference

| Service | Port |
|---|---|
| Frontend | 30080 |
| Backend API | 30001 |
| ArgoCD UI | 32443 (NodePort, varies) |
| SSH | 22 |

---

## Cleanup (After Grading Only)

```bash
cd terraform
terraform destroy    # type 'yes' when prompted
```

This permanently deletes the EC2 instance and all AWS resources.
