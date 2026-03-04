

# 🧠 BRAIN TUMOR DETECTION SYSTEM — Implementation Plan

## Overview
A dark-mode, medical-grade web application for brain tumor detection from MRI images. The app integrates with an external Python inference API (to be set up later) and uses Supabase for auth, database, and file storage.

---

## Phase 1: Foundation & Authentication

### Supabase Setup (Lovable Cloud)
- Enable Lovable Cloud with Supabase for auth, database, and storage
- Create database tables: `patients`, `mri_uploads`, `predictions`, `metrics`, `contact_messages`
- Create `user_roles` table with roles: **Admin**, **Doctor**, **Radiologist** (enum-based, security-definer role check function)
- Create `profiles` table linked to `auth.users`
- Create 4 storage buckets: `mri_images`, `gradcam_images`, `charts`, `reports`
- RLS policies on all tables scoped by role and authenticated user

### Login / Sign-Up Page
- Dark themed page with "BRAIN TUMOR DETECTION SYSTEM" header
- Login card with email + password fields
- Sign-up flow for new users
- After login, redirect to Dashboard
- All other routes are protected (require authentication)

---

## Phase 2: Dashboard & Navigation

### Dashboard Layout
- Dark mode medical UI with a top header showing 5 clickable tabs:
  1. **Upload Image** | 2. **Patient Info** | 3. **Queue Order** | 4. **Results** | 5. **Contact Us**
- Each tab navigates to its respective page
- Active tab highlighted
- User menu with logout option

---

## Phase 3: Upload Image Tab

### Patient Entry
- Create or select a patient by `case_id`
- Form fields: case_id, patient_name, age, gender, seizure (checkbox), headache_severity (Mild/Medium/Severe)

### MRI Upload
- Drag-and-drop or file picker for MRI images (JPG/PNG only)
- Invalid file types show: **"INVALID INPUT — Provide a proper MRI Brain Scan image."**
- Uploaded files go to Supabase Storage (`mri_images` bucket)
- Each upload saved with ascending `upload_order`

### "SCAN MRI" Button
- Sends uploaded image URLs to a Supabase Edge Function
- Edge function calls the external Python API at a configurable `INFERENCE_API_URL`
- Receives prediction results (tumor type, probabilities, Grad-CAM, metrics, confusion matrix, ROC curve)
- Uploads base64 images (Grad-CAM, charts) to Supabase Storage
- Saves prediction + metrics to database
- Computes severity level (RED/YELLOW/GREEN) and queue rank
- If no tumor → shows "TUMOR NOT DETECTED" message, stays on Upload tab
- If tumor detected → auto-navigates to Results tab

---

## Phase 4: Patient Info Tab

### Patient Table
- Displays all patients: case_id, name, age, gender, seizure, headache severity
- Clickable patient name opens detail view

### Patient Detail View
- Shows patient's MRI images in upload order as a gallery/carousel
- Displays patient metadata

---

## Phase 5: Queue Order Tab

### Priority Queue Table
- Columns: case_id, patient_name, age, gender, seizure, headache_severity, queue_rank, severity badge
- Color-coded severity badges:
  - 🔴 **RED** = Glioma/Meningioma (highest priority)
  - 🟡 **YELLOW** = Pituitary tumor
  - 🟢 **GREEN** = No tumor
- Sorted: RED first → YELLOW → GREEN, then by queue_rank within each group

---

## Phase 6: Results Tab

### Patient Selection
- Select patient by case_id dropdown

### Results Display
- Tumor Present: Yes/No
- Tumor Type: Glioma / Meningioma / Pituitary / NoTumor
- Probability breakdown visualization
- Side-by-side images: Original MRI | Grad-CAM Heatmap
- Full metrics display: precision, recall, F1-score, support, accuracy, sensitivity, specificity, ROC AUC, TP, TN, FP, FN
- Confusion matrix image and ROC curve image

### Report Download
- "Download Patient Report" button
- Generates a comprehensive report with: patient info, MRI image, Grad-CAM, all metrics, confusion matrix, ROC curve
- Export as **PDF** and **PNG**
- Saves generated reports to Supabase Storage (`reports` bucket)

---

## Phase 7: Contact Us Tab

- Contact form: name, email, message
- Submissions stored in `contact_messages` table in Supabase
- Displays support contact information placeholders

---

## Phase 8: External API Integration (Edge Function)

### Supabase Edge Function: `predict`
- Accepts: case_id, patient_id, image_urls
- Calls `POST {INFERENCE_API_URL}/predict` (URL stored as a Supabase secret)
- Processes response: uploads base64 images to storage, saves all data to DB
- Returns results to frontend
- The `INFERENCE_API_URL` will be configurable — you'll set it once your Python API is deployed

---

## Design & UX
- **Dark mode** throughout with medical accent colors (deep blues, teals, subtle reds for alerts)
- Responsive design for desktop and tablet
- Clean typography, card-based layouts
- Loading states and error handling throughout
- Toast notifications for actions (upload success, scan complete, errors)

