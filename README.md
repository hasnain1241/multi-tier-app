# Multi-Tier Application Deployment

## Overview
Automated deployment pipeline for a multi-tier microservices application using Docker, Terraform, Ansible, Kubernetes, GitHub Actions, and ArgoCD.

## Architecture
- Frontend: Nginx serving static HTML (NodePort 30080)
- Backend: Node.js Express API (NodePort 30001)
- Infrastructure: AWS EC2 (t2.medium) in custom VPC
- Cluster: microk8s single-node Kubernetes
- CD: ArgoCD GitOps synchronization

## Deployment Steps

### 1. Prerequisites
Install: terraform, ansible, docker, aws-cli, git

### 2. Provision Infrastructure
cd terraform && terraform init && terraform apply

### 3. Configure Server
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml

### 4. Configure ArgoCD
- Get password: kubectl -n argocd get secret argocd-initial-admin-secret ...
- Access UI: https://<EC2_IP>:<NODEPORT>
- Create application pointing to k8s/ directory

### 5. Trigger CI
Push any code change to main branch to trigger GitHub Actions

## Port Reference
| Service     | Port  |
|-------------|-------|
| Frontend    | 30080 |
| Backend API | 30001 |
| ArgoCD      | 32443 |

## Cleanup
cd terraform && terraform destroy
