# Pilot Guide — Multi-Tenant Tour Wizard (Denali)

This guide provides technical and operational instructions for the Pilot team during the Denali rollout.

---

## 1. Environment & Entry Points

| Tenant | Subdomain (Local) | Login Phone | Note |
|--------|-------------------|-------------|------|
| **Denali** | `denali.localhost:3000` | `+989121000001` | Mountain/Nature focus |
| **Urban Demo** | `urban-demo.localhost:3000` | `+989121000002` | City events focus |
| **Mix Demo** | `mix-demo.localhost:3000` | `+989121000003` | Hybrid/Cinema focus |

**OTP for all:** `1234` (Dev mode)

---

## 2. Core Concepts

### 2.1 Tour Form Profiles
The Wizard is no longer "one-size-fits-all". It adapts based on the selected **Theme**:
- **`mountain_outdoor`**: Full 9-step rail (Itinerary, Participation, etc.).
- **`urban_event`**: Slim rail (5 steps). Hides Itinerary, Participation, and Logistics.
- **`cinema_event`**: Mid-sized rail. Hides Itinerary and Participation.

### 2.2 Sticky Profiles
If you change a theme and then go back, the wizard remembers your choice. The "Badge" in the top-right corner of the wizard (in dev mode) shows the active profile.

### 2.3 Tenant Templates
Administrators can customize the wizard via `TenantWizardTemplate`:
- **Base Profile**: Change the default profile for new tours.
- **Step Overrides**: Force skip specific steps.
- **Field Overlays**: Change visibility/required-ness of individual fields via JSON.

---

## 3. Operational Scenarios

### 3.1 Scenario: Cross-Tenant Isolation
1. Start a draft on `denali.localhost`.
2. Open `urban-demo.localhost` in another tab.
3. Verify that the Denali draft is **not visible** on the Urban dashboard.
4. Complete the Urban draft and verify it remains isolated.

### 3.2 Scenario: Profile Flip (Ghost Data)
1. Select a **Mountain** theme and fill out the Itinerary.
2. Flip to an **Urban** theme (Itinerary step disappears).
3. Submit the tour.
4. Verify in the API/Database that the `itinerary` object is **empty/stripped**, preventing "ghost data" from leaking.

---

## 4. Support & Logs

Grep for `tour_profile_obs` in client logs to find validation drift or profile-related warnings.
- **Backend logs**: Filter by `tenant_id` to trace specific submission failures.
- **Validation errors**: Each wizard step reports `isValid` and detailed `issues` in the browser console during dev.

---
*Last Updated: 2026-05-18*
