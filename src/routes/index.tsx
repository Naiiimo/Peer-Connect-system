import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, BookOpen, Users, MessageSquare, Calendar, Library, Star, ArrowRight, MapPin, Mail, Phone } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { USIU_ADDRESS } from "@/lib/schools";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      {/* Hero slideshow */}
      <HeroSlideshow>
        <div className="mx-auto max-w-3xl text-primary-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> USIU-Africa Peer Learning
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight drop-shadow-md md:text-6xl">
            Learn together.<br />
            <span className="bg-gradient-to-r from-accent to-yellow-200 bg-clip-text text-transparent">Grow further.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/90 drop-shadow md:text-lg">
            Peer Connect matches USIU students with student-tutors, study groups and shared resources — everything you need to master your programme.
          </p>
        </div>

        {/* Are you cards */}
        <div className="mt-12 grid w-full max-w-3xl gap-4 md:grid-cols-2">
          <RoleCard
            role="student"
            title="Are you a Student?"
            blurb="Find tutors in your programme, join study groups, and level up."
            icon={<BookOpen className="h-6 w-6" />}
          />
          <RoleCard
            role="tutor"
            title="Are you a Tutor?"
            blurb="Share what you know. Build reviews. Get discovered by students."
            icon={<GraduationCap className="h-6 w-6" />}
          />
        </div>
      </HeroSlideshow>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Everything you need to study smarter</h2>
          <p className="mt-3 text-muted-foreground">Purpose-built tools for the way USIU students actually learn.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Feature icon={<Users />} title="Find your tutor" body="Search by course, name or email. See ratings and specializations at a glance." />
          <Feature icon={<MessageSquare />} title="Real-time messaging" body="Chat 1-on-1 or in study groups. Share notes and documents instantly." />
          <Feature icon={<Calendar />} title="Schedule sessions" body="View tutor availability, book sessions and get session reminders." />
          <Feature icon={<Library />} title="Shared library" body="Upload and save documents, notes and past papers in one place." />
          <Feature icon={<Star />} title="Reviews that matter" body="Rate tutors after sessions. Great tutors rise to the top for everyone." />
          <Feature icon={<GraduationCap />} title="Study groups" body="Join groups by programme or start your own with your classmates." />
        </div>
      </section>

      {/* Footer / address */}
      <footer className="border-t border-border bg-secondary/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 font-display font-semibold">
              <div className="grid h-9 w-9 place-items-center rounded-md gradient-hero text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
              USIU Peer Connect
            </div>
            <p className="mt-3 text-sm text-muted-foreground">A peer learning platform built for USIU-Africa students.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">{USIU_ADDRESS.name}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0" />{USIU_ADDRESS.street} · {USIU_ADDRESS.poBox} · {USIU_ADDRESS.city}</li>
              <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0" />{USIU_ADDRESS.phone}</li>
              <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0" />{USIU_ADDRESS.email}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Get started</h4>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link to="/register/$role" params={{ role: "student" }} className="text-muted-foreground hover:text-foreground">Register as student</Link>
              <Link to="/register/$role" params={{ role: "tutor" }} className="text-muted-foreground hover:text-foreground">Register as tutor</Link>
              <Link to="/settings" className="text-muted-foreground hover:text-foreground">Settings</Link>
              <Link to="/admin-login" className="text-muted-foreground hover:text-foreground">Admin sign in</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} USIU Peer Connect</div>
      </footer>
    </div>
  );
}

function RoleCard({ role, title, blurb, icon }: { role: "student" | "tutor"; title: string; blurb: string; icon: React.ReactNode }) {
  return (
    <div className="group rounded-xl border border-white/15 bg-white/10 p-6 backdrop-blur-md transition hover:border-accent/60 hover:bg-white/15">
      <div className="mb-3 inline-grid h-11 w-11 place-items-center rounded-lg gradient-gold text-accent-foreground">{icon}</div>
      <h3 className="font-display text-xl font-semibold text-primary-foreground">{title}</h3>
      <p className="mt-1 text-sm text-white/75">{blurb}</p>
      <div className="mt-5 flex gap-2">
        <Link to="/auth/$role" params={{ role }}>
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">{role === "student" ? "Student here" : "Tutor here"} <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </Link>
        <Link to="/register/$role" params={{ role }}>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">Register</Button>
        </Link>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card-elevated p-6">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">{icon}</div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
