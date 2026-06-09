# AIWOS_CONTEXT.md

# AI Workforce Operating System (AIWOS)

Version: 1.0

## Project Summary

AI Workforce Operating System (AIWOS) is an enterprise SaaS platform that allows organizations to create, manage, orchestrate, monitor, and scale AI-powered digital employees across multiple business departments.

The platform is not an AI chatbot and not an AI website generator.

The platform is an operating system for AI employees.

Organizations can:

* Create Departments
* Create Teams
* Create Digital Employees (AI Agents)
* Assign Tasks
* Create Projects
* Monitor Performance
* Track Costs
* View Agent Communications
* Generate Business Outputs
* Generate Software Applications

---

# Target Users

Primary Users:

* Enterprises
* Software Development Agencies
* Consulting Firms
* Startups

Roles:

* Super Admin
* Organization Admin
* Manager
* Viewer

---

# Core Departments

1. Development Department
2. Research Department
3. Sales Department
4. HR Department
5. Support Department
6. Finance Department

Custom departments must also be supported.

---

# Workforce Structure

Organization
│
├── Departments
│
├── Department Manager Agent
│
├── Employee Agents
│
├── Projects
│
├── Tasks
│
└── Knowledge Base

---

# Development Department

Manager:
Development Manager Agent

Employees:

* Business Analyst Agent
* UI Designer Agent
* Frontend Developer Agent
* Backend Developer Agent
* QA Engineer Agent
* DevOps Engineer Agent

---

# Research Department

Manager:
Research Manager Agent

Employees:

* Market Research Agent
* Competitor Analysis Agent

---

# Sales Department

Manager:
Sales Manager Agent

Employees:

* Lead Generation Agent
* Outreach Agent

---

# HR Department

Manager:
HR Manager Agent

Employees:

* Recruitment Agent

---

# Support Department

Manager:
Support Manager Agent

Employees:

* Support Agent

---

# Finance Department

Manager:
Finance Manager Agent

Employees:

* Finance Agent

---

# Agent Rules

Every Agent Has:

* Name
* Role
* Goal
* Instructions
* Memory
* Tools
* Permissions
* KPIs

Every Agent Must:

* Log actions
* Communicate publicly
* Escalate when blocked
* Follow department scope

Agent Status:

* Created
* Active
* Busy
* Waiting
* Blocked
* Escalated
* Completed
* Archived

---

# Communication Model

All communication is public.

Communication Types:

* Agent to Agent
* Agent to Human
* Human to Agent
* System Messages

Humans can view all conversations.

---

# Primary User Experience

Homepage:

Command Center

Prompt:

"What would you like your workforce to do today?"

Examples:

* Build CRM Application
* Generate Market Research
* Hire React Developer
* Create Sales Campaign

---

# Core Modules

1. Authentication
2. Command Center
3. Dashboard
4. Departments
5. Digital Employees
6. Projects
7. Tasks
8. Workflows
9. Communications
10. Knowledge Base
11. Analytics
12. Integrations
13. Settings

---

# MVP Scope

Required:

* Authentication
* Organization Creation
* Workforce Setup Wizard
* Department Management
* Agent Management
* Project Management
* Task Management
* Agent Communications
* Knowledge Base
* LangGraph Workflow Engine

Not Required:

* Billing
* Marketplace
* Enterprise SSO
* Kubernetes
* Multi-Cloud

---

# Software Generation Workflow

User Request:

Build Hospital Management System

Workflow:

Development Manager
→ Business Analyst
→ UI Designer
→ Frontend Developer
→ Backend Developer
→ QA Engineer
→ DevOps Engineer

Outputs:

* Requirements
* UI Specifications
* React Code
* FastAPI Code
* Test Cases
* Documentation

---

# Technology Stack

Frontend:

* Next.js 15
* TypeScript
* TailwindCSS
* shadcn/ui

Backend:

* FastAPI
* Python 3.12+

Database:

* PostgreSQL
* Supabase

Vector Search:

* pgvector

Authentication:

* Supabase Auth

Agent Framework:

* LangGraph

Deployment:

Frontend:

* Vercel

Backend:

* Railway or Render

---

# Windows Development Rules

Target Environment:

Windows 11

Use:

* PowerShell Commands
* npm
* pnpm
* Python 3.12+

Do Not Use:

* Bash
* Ubuntu Commands
* Linux Scripts
* WSL Requirements
* Docker Requirements for MVP

All generated code must run on Windows.

---

# Frontend Routes

/login

/signup

/setup

/command-center

/dashboard

/departments

/agents

/projects

/tasks

/workflows

/communications

/knowledge-base

/analytics

/integrations

/settings

---

# Database Core Tables

organizations

users

departments

agents

projects

tasks

workflows

conversations

messages

knowledge_files

knowledge_chunks

execution_logs

agent_metrics

---

# Folder Structure

frontend/

backend/

database/

agents/

workflows/

prompts/

shared/

tests/

docs/

---

# AI Generation Rules

When generating code:

1. Follow existing architecture.
2. Do not modify unrelated modules.
3. Return complete file trees.
4. Use TypeScript strictly.
5. Use FastAPI best practices.
6. Use Supabase integration.
7. Generate production-ready code.
8. Include error handling.
9. Include validation.
10. Include comments only where necessary.

---

# Output Standards

Every generated module must include:

* File Tree
* Required Files
* Type Definitions
* API Integration
* Error Handling
* Loading States
* Responsive UI
* Production Readiness

This document is the official source of truth for AIWOS.
