import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

export function MentionsLegales() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#09090f",
      color: "rgba(255,255,255,0.82)",
      padding: "24px 20px 60px",
      maxWidth: 680,
      margin: "0 auto",
      fontFamily: "inherit",
    }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.45)", fontSize: 14, padding: "0 0 28px",
        }}
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", margin: "0 0 6px", letterSpacing: "-0.4px" }}>
        Mentions légales
      </h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "0 0 36px" }}>
        En vigueur au 10/05/2026
      </p>

      <Section>
        <p>
          Conformément aux dispositions de la loi n°2004-575 du 21 juin 2004 pour la Confiance en l'économie numérique,
          il est précisé aux utilisateurs du site <span translate="no" className="notranslate">Fowards</span> l'identité
          des différents intervenants dans le cadre de sa réalisation et de son suivi.
        </p>
      </Section>

      <Section title="ÉDITION DU SITE">
        <p>
          Le présent site est édité par :<br /><br />
          <strong>Monsieur Léo Le Guillou</strong><br />
          Druillat, l'Ain 01<br />
          Téléphone : 0767913803<br />
          E-mail : <a href="mailto:neyvo.entreprise@gmail.com" style={{ color: "rgba(255,255,255,0.55)" }}>neyvo.entreprise@gmail.com</a>
        </p>
      </Section>

      <Section title="HÉBERGEUR">
        <p>
          Le site est hébergé par :<br /><br />
          <strong>Cloudflare, Inc.</strong><br />
          101 Townsend Street<br />
          94107 San Francisco, États-Unis
        </p>
      </Section>

      <Section title="ACCÈS AU SITE">
        <p>
          Le site est accessible par tout endroit, 7j/7, 24h/24 sauf cas de force majeure, interruption programmée
          ou non et pouvant découler d'une nécessité de maintenance.
        </p>
        <p style={{ marginTop: 12 }}>
          En cas de modification, interruption ou suspension des services, le site{" "}
          <span translate="no" className="notranslate">Fowards</span> ne saurait être tenu responsable.
        </p>
      </Section>

      <Section title="COLLECTE DES DONNÉES">
        <p>
          Le site assure à l'Utilisateur une collecte et un traitement d'informations personnelles dans le respect
          de la vie privée conformément à la loi n°78-17 du 6 janvier 1978 relative à l'informatique, aux fichiers
          et aux libertés.
        </p>
        <p style={{ marginTop: 12 }}>
          En vertu de la loi Informatique et Libertés, en date du 6 janvier 1978, l'Utilisateur dispose d'un droit
          d'accès, de rectification, de suppression et d'opposition de ses données personnelles. L'Utilisateur exerce
          ce droit via :<br /><br />
          — son espace personnel ;<br />
          — le formulaire de contact à l'adresse{" "}
          <a href="mailto:neyvo.entreprise@gmail.com" style={{ color: "rgba(255,255,255,0.55)" }}>
            neyvo.entreprise@gmail.com
          </a>
        </p>
      </Section>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", marginTop: 40 }}>
        Rédigé sur legalplace.fr
      </p>
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 10px" }}>
          {title}
        </h2>
      )}
      <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)" }}>
        {children}
      </div>
    </div>
  );
}
