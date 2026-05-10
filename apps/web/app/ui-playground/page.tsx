"use client";

/**
 * Internal UI Playground — design review & UI QA on every Vercel Preview (`/ui-playground`).
 * Not product-facing; see README.md in this folder.
 */

import { useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardSubtitle,
  CardTitle,
  Checkbox,
  FormField,
  Input,
  Modal,
  Radio,
  Select,
  Textarea,
} from "@tour/ui";
import { useThemeSwitcher } from "@/hooks/useThemeSwitcher";

import styles from "./playground.module.css";

export default function UiPlaygroundPage() {
  const { theme, setTheme, toggleTheme } = useThemeSwitcher("light");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.toolbarTitle}>UI playground</h1>
        <div className={styles.themeToggle}>
          <span>Theme</span>
          <div className={styles.themeButtons}>
            <Button
              type="button"
              variant={theme === "light" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              type="button"
              variant={theme === "dark" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={toggleTheme}>
              Toggle
            </Button>
          </div>
        </div>
      </div>

      <section id="section-buttons" className={styles.section} aria-labelledby="playground-buttons">
        <h2 id="playground-buttons" className={styles.sectionTitle}>
          Buttons
        </h2>
        <p className={styles.subheading}>Variants</p>
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <p className={styles.subheading}>States</p>
        <div className={styles.row}>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" loading>
            Loading
          </Button>
        </div>
        <p className={styles.subheading}>Sizes</p>
        <div className={styles.row}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section id="section-inputs" className={styles.section} aria-labelledby="playground-inputs">
        <h2 id="playground-inputs" className={styles.sectionTitle}>
          Inputs
        </h2>
        <div className={`${styles.row} ${styles.rowStretch}`}>
          <div className={styles.stack}>
            <Input label="Default" placeholder="Type here…" defaultValue="" />
            <p className={styles.note}>Standard resting state.</p>
          </div>
          <div className={styles.stack}>
            <Input label="Focused (autoFocus)" placeholder="Focused on load" autoFocus />
            <p className={styles.note}>Uses native focus ring from the control.</p>
          </div>
          <div className={styles.stack}>
            <Input
              label="With error"
              placeholder="Invalid value"
              defaultValue="bad"
              error="This field must match the expected format."
            />
            <p className={styles.note}>Invalid state + helper copy.</p>
          </div>
          <div className={styles.stack}>
            <Input
              label="Helper text"
              placeholder="Optional"
              helperText="Shown below the field until an error replaces emphasis."
            />
          </div>
          <div className={styles.stack}>
            <Input label="Disabled" placeholder="Read-only slot" disabled />
          </div>
        </div>
      </section>

      <section id="section-cards" className={styles.section} aria-labelledby="playground-cards">
        <h2 id="playground-cards" className={styles.sectionTitle}>
          Cards
        </h2>
        <div className={`${styles.row} ${styles.rowStretch}`}>
          <Card className={styles.stack}>
            <CardBody>Default card — body only with neutral surface tokens.</CardBody>
          </Card>
          <Card className={styles.stack}>
            <CardHeader>
              <CardTitle>With header</CardTitle>
              <CardSubtitle>Optional subtitle for context.</CardSubtitle>
            </CardHeader>
            <CardBody>Structured layout using header + body regions.</CardBody>
            <CardFooter>
              <Button variant="secondary" size="sm">
                Secondary
              </Button>
              <Button size="sm">Primary</Button>
            </CardFooter>
          </Card>
          <Card className={`${styles.stack} ${styles.highlightedCard}`}>
            <CardHeader>
              <CardTitle>Highlighted</CardTitle>
            </CardHeader>
            <CardBody>Strong border + elevated shadow for emphasis.</CardBody>
          </Card>
          <Card
            className={styles.stack}
            title="Prop-based API"
            description="Optional title, description, and actions without subcomponents."
            actions={
              <>
                <Button variant="secondary" size="sm">
                  Dismiss
                </Button>
                <Button size="sm">Continue</Button>
              </>
            }
          >
            Main content lives in children with the same body padding as CardBody.
          </Card>
        </div>
      </section>

      <section id="section-alerts" className={styles.section} aria-labelledby="playground-alerts">
        <h2 id="playground-alerts" className={styles.sectionTitle}>
          Alerts
        </h2>
        <div className={styles.stack}>
          <Alert variant="info" title="Info">
            Operational notice — aligns with info semantic tokens.
          </Alert>
          <Alert variant="success" title="Success">
            Registration or payment completed successfully.
          </Alert>
          <Alert variant="warning" title="Warning">
            Async payment pending — user should wait or retry later.
          </Alert>
          <Alert variant="error" title="Error" role="alert">
            Something failed; include recovery steps where possible.
          </Alert>
        </div>
      </section>

      <section
        id="section-more-forms"
        className={styles.section}
        aria-labelledby="playground-more-forms"
      >
        <h2 id="playground-more-forms" className={styles.sectionTitle}>
          More form controls
        </h2>
        <div className={`${styles.row} ${styles.rowStretch}`}>
          <div className={styles.stack}>
            <FormField label="Notes">
              <Textarea placeholder="Multi-line…" rows={3} />
            </FormField>
            <p className={styles.note}>Textarea full-width + resize vertical.</p>
          </div>
          <div className={styles.stack}>
            <FormField label="Country">
              <Select defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                <option value="ir">Iran</option>
                <option value="de">Germany</option>
              </Select>
            </FormField>
            <p className={styles.note}>Native select, styled shell.</p>
          </div>
          <div className={styles.stack}>
            <Checkbox label="Subscribe to updates" />
            <div className={styles.row}>
              <Radio name="playground-radio" value="a" defaultChecked label="Option A" />
              <Radio name="playground-radio" value="b" label="Option B" />
            </div>
          </div>
          <div className={styles.stack}>
            <FormField label="Full name" description="Will appear in your profile" error="Text is required" required>
              <Input placeholder="Jane Doe" defaultValue="" />
            </FormField>
          </div>
          <div className={styles.stack}>
            <FormField label="Bio">
              <Textarea rows={2} placeholder="Short bio" />
            </FormField>
          </div>
          <div className={styles.stack}>
            <FormField label="Role">
              <Select defaultValue="member">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </FormField>
          </div>
          <div className={styles.stack}>
            <FormField label="Accept terms" description="Required to continue">
              <Checkbox bare />
            </FormField>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="playground-modal">
        <h2 id="playground-modal" className={styles.sectionTitle}>
          Modal
        </h2>
        <div className={styles.row}>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Confirm action"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Confirm
              </Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            Modal uses portal, scrim, and escape-to-close. Footer holds actions.
          </p>
        </Modal>
      </section>

      <section className={styles.section} aria-labelledby="playground-badges">
        <h2 id="playground-badges" className={styles.sectionTitle}>
          Badges
        </h2>
        <div className={styles.row}>
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
        </div>
      </section>
    </main>
  );
}
