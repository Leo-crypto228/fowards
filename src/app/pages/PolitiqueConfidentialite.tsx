import { useNavigate, Link } from "react-router";
import { ArrowLeft } from "lucide-react";

export function PolitiqueConfidentialite() {
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

      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", margin: "0 0 2px", letterSpacing: "-0.4px" }}>
        {"Politique de confidentialité"}
      </h1>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", margin: "0 0 36px" }}>
        <span translate="no" className="notranslate">Fowards</span>
      </p>

      <Section title="Article 1 : Préambule">
        <p>{"La présente politique de confidentialité a pour but d'informer les utilisateurs du site :"}</p>
        <ul style={{ marginTop: 10, paddingLeft: 20, lineHeight: 2 }}>
          <li>{"Sur la manière dont sont collectées leurs données personnelles. Sont considérées comme des données personnelles, toute information permettant d'identifier un utilisateur. À ce titre, il peut s'agir : de ses noms et prénoms, de son âge, de son adresse postale ou email, de sa localisation ou encore de son adresse IP (liste non-exhaustive) ;"}</li>
          <li>{"Sur les droits dont ils disposent concernant ces données ;"}</li>
          <li>{"Sur la personne responsable du traitement des données à caractère personnel collectées et traitées ;"}</li>
          <li>{"Sur les destinataires de ces données personnelles ;"}</li>
          <li>{"Sur la politique du site en matière de cookies."}</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          {"Cette politique complète les"}{" "}
          <Link to="/mentions-legales" style={{ color: "rgba(255,255,255,0.55)" }}>{"mentions légales"}</Link>
          {" et les"}{" "}
          <Link to="/conditions" style={{ color: "rgba(255,255,255,0.55)" }}>{"Conditions Générales d'Utilisation"}</Link>
          {" consultables par les utilisateurs sur le site."}
        </p>
      </Section>

      <Section title="Article 2 : Principes relatifs à la collecte et au traitement des données personnelles">
        <p>{"Conformément à l'article 5 du Règlement européen 2016/679, les données à caractère personnel sont :"}</p>
        <ul style={{ marginTop: 10, paddingLeft: 20, lineHeight: 2 }}>
          <li>{"Traitées de manière licite, loyale et transparente au regard de la personne concernée ;"}</li>
          <li>{"Collectées pour des finalités déterminées, explicites et légitimes, et ne pas être traitées ultérieurement d'une manière incompatible avec ces finalités ;"}</li>
          <li>{"Adéquates, pertinentes et limitées à ce qui est nécessaire au regard des finalités pour lesquelles elles sont traitées ;"}</li>
          <li>{"Exactes et, si nécessaire, tenues à jour. Toutes les mesures raisonnables doivent être prises pour que les données inexactes soient effacées ou rectifiées sans tarder ;"}</li>
          <li>{"Conservées sous une forme permettant l'identification des personnes concernées pendant une durée n'excédant pas celle nécessaire au regard des finalités ;"}</li>
          <li>{"Traitées de façon à garantir une sécurité appropriée des données collectées, y compris la protection contre le traitement non autorisé ou illicite et contre la perte, la destruction ou les dégâts d'origine accidentelle."}</li>
        </ul>
        <p style={{ marginTop: 12 }}>{"Le traitement n'est licite que si au moins une des conditions suivantes est remplie :"}</p>
        <ul style={{ marginTop: 10, paddingLeft: 20, lineHeight: 2 }}>
          <li>{"La personne concernée a consenti au traitement de ses données à caractère personnel pour une ou plusieurs finalités spécifiques ;"}</li>
          <li>{"Le traitement est nécessaire à l'exécution d'un contrat auquel la personne concernée est partie ;"}</li>
          <li>{"Le traitement est nécessaire au respect d'une obligation légale à laquelle le responsable du traitement est soumis ;"}</li>
          <li>{"Le traitement est nécessaire à la sauvegarde des intérêts vitaux de la personne concernée ou d'une autre personne physique ;"}</li>
          <li>{"Le traitement est nécessaire à l'exécution d'une mission d'intérêt public ou relevant de l'exercice de l'autorité publique ;"}</li>
          <li>{"Le traitement est nécessaire aux fins des intérêts légitimes poursuivis par le responsable du traitement ou par un tiers, à moins que ne prévalent les intérêts ou les libertés et droits fondamentaux de la personne concernée."}</li>
        </ul>
      </Section>

      <Section title="Article 3 : Données à caractère personnel collectées et traitées">
        <SubSection title="Article 3.1 : Données collectées">
          <p>{"Les données personnelles collectées dans le cadre de notre activité sont les suivantes :"}</p>
          <p style={{ marginTop: 8, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>{"E-mail, Nom et Prénom"}</p>
          <p style={{ marginTop: 12 }}>{"La collecte et le traitement de ces données répondent aux finalités suivantes : gestion des comptes utilisateurs, fonctionnement de la plateforme communautaire, amélioration de l'expérience utilisateur, sécurité et modération des contenus, envoi d'informations liées au service."}</p>
        </SubSection>

        <SubSection title="Article 3.2 : Mode de collecte des données">
          <p>{"Lorsque vous utilisez notre site, sont automatiquement collectées les données suivantes : e-mail, nom et prénom."}</p>
          <p style={{ marginTop: 12 }}>{"Ces données sont collectées afin de créer et d'enregistrer le compte et de le répertorier dans notre base de données."}</p>
          <p style={{ marginTop: 12 }}>{"Elles sont conservées par le responsable du traitement dans des conditions raisonnables de sécurité, pour une durée non déterminée. La société est susceptible de conserver certaines données à caractère personnel au-delà de ces délais afin de remplir ses obligations légales ou réglementaires."}</p>
        </SubSection>

        <SubSection title="Article 3.3 : Hébergement des données">
          <p>{"Le site"} <span translate="no" className="notranslate">Fowards</span> {"est hébergé par :"}</p>
          <p style={{ marginTop: 10 }}>
            <strong>{"Cloudflare, Inc."}</strong><br />
            {"101 Townsend Street"}<br />
            {"San Francisco, CA 94107 — États-Unis"}<br />
            {"Tél. : +1 650-319-8930"}
          </p>
        </SubSection>

        <SubSection title="Article 3.4 : Transmission des données à des tiers">
          <p>{"Les données peuvent être transmises à nos partenaires ci-après énumérés :"}</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, lineHeight: 2 }}>
            <li>{"Cloudflare (sécurité et performance du site)"}</li>
            <li>{"Supabase (hébergement et base de données)"}</li>
            <li>{"Resend (envoi d'emails)"}</li>
          </ul>
          <p style={{ marginTop: 12 }}>{"Ces partenaires agissent en tant que sous-traitants et respectent la réglementation en vigueur relative à la protection des données personnelles."}</p>
        </SubSection>

        <SubSection title="Article 3.5 : Politique en matière de cookies">
          <p>
            {"Le site"} <span translate="no" className="notranslate">Fowards</span>{" "}
            {"utilise des cookies afin d'améliorer l'expérience utilisateur, mesurer l'audience et assurer le bon fonctionnement du site. Ces cookies peuvent être déposés par"} <span translate="no" className="notranslate">Fowards</span> {"ou par des services tiers tels que Cloudflare."}
          </p>
          <p style={{ marginTop: 12 }}>{"L'utilisateur peut configurer ses préférences en matière de cookies directement depuis son navigateur."}</p>
        </SubSection>
      </Section>

      <Section title="Article 4 : Responsable du traitement des données et délégué à la protection des données">
        <SubSection title="Article 4.1 : Le responsable du traitement des données">
          <p>
            {"Les données à caractère personnel sont collectées par"} <span translate="no" className="notranslate">Fowards</span>, {"micro-entreprise, au capital de 0 euro."}
          </p>
          <p style={{ marginTop: 12 }}>
            {"Le responsable du traitement peut être contacté de la manière suivante :"}<br /><br />
            {"Par téléphone : 07 67 91 38 03"}<br />
            {"Par mail :"} <a href="mailto:neyvo.entreprise@gmail.com" style={{ color: "rgba(255,255,255,0.55)" }}>neyvo.entreprise@gmail.com</a>
          </p>
        </SubSection>

        <SubSection title="Article 4.2 : Le délégué à la protection des données">
          <p>
            {"Le délégué à la protection des données est le responsable du traitement ("}<span translate="no" className="notranslate">Fowards</span>{")."}<br /><br />
            {"Adresse : 01 Druillat, l'Ain, France"}<br />
            {"Email :"} <a href="mailto:neyvo.entreprise@gmail.com" style={{ color: "rgba(255,255,255,0.55)" }}>neyvo.entreprise@gmail.com</a>
          </p>
          <p style={{ marginTop: 12 }}>{"Si vous estimez, après nous avoir contactés, que vos droits « Informatique et Libertés » ne sont pas respectés, vous pouvez adresser une information à la CNIL."}</p>
        </SubSection>
      </Section>

      <Section title="Article 5 : Les droits de l'Utilisateur en matière de collecte et de traitement des données">
        <p>{"Tout utilisateur concerné par le traitement de ses données personnelles peut se prévaloir des droits suivants, en application du règlement européen 2016/679 et de la Loi Informatique et Liberté (Loi 78-17 du 6 janvier 1978) :"}</p>
        <ul style={{ marginTop: 10, paddingLeft: 20, lineHeight: 2 }}>
          <li>{"Droit d'accès, de rectification et droit à l'effacement des données (articles 15, 16 et 17 du RGPD) ;"}</li>
          <li>{"Droit à la portabilité des données (article 20 du RGPD) ;"}</li>
          <li>{"Droit à la limitation (article 18 du RGPD) et à l'opposition du traitement des données (article 21 du RGPD) ;"}</li>
          <li>{"Droit de ne pas faire l'objet d'une décision fondée exclusivement sur un procédé automatisé ;"}</li>
          <li>{"Droit de déterminer le sort des données après la mort ;"}</li>
          <li>{"Droit de saisir l'autorité de contrôle compétente (article 77 du RGPD)."}</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          {"Pour exercer vos droits, veuillez adresser votre courrier à"} <span translate="no" className="notranslate">Fowards</span> {"— 01 Druillat l'Ain France, ou par mail à"} <a href="mailto:neyvo.entreprise@gmail.com" style={{ color: "rgba(255,255,255,0.55)" }}>neyvo.entreprise@gmail.com</a>.
        </p>
        <p style={{ marginTop: 12 }}>{"Afin que le responsable du traitement puisse faire droit à sa demande, l'utilisateur peut être tenu de communiquer certaines informations telles que ses noms et prénoms, son adresse e-mail ainsi que son numéro de compte."}</p>
        <p style={{ marginTop: 12 }}>{"Consultez le site cnil.fr pour plus d'informations sur vos droits."}</p>
      </Section>

      <Section title="Article 6 : Conditions de modification de la politique de confidentialité">
        <p>
          {"L'éditeur du site"} <span translate="no" className="notranslate">Fowards</span>{" "}
          {"se réserve le droit de pouvoir modifier la présente politique à tout moment afin d'assurer aux utilisateurs du site sa conformité avec le droit en vigueur."}
        </p>
        <p style={{ marginTop: 12 }}>{"Les éventuelles modifications ne sauraient avoir d'incidence sur les achats antérieurement effectués sur le site, lesquels restent soumis à la politique en vigueur au moment de l'achat et telle qu'acceptée par l'utilisateur lors de la validation de l'achat."}</p>
        <p style={{ marginTop: 12 }}>{"L'utilisateur est invité à prendre connaissance de cette politique à chaque fois qu'il utilise nos services, sans qu'il soit nécessaire de l'en prévenir formellement."}</p>
        <p style={{ marginTop: 12, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{"La présente politique, éditée le 10/05/2026, a été mise à jour le 10/05/2026."}</p>
      </Section>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", marginTop: 40 }}>
        {"Modèle réalisé sur legalplace.fr"}
      </p>
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 12px" }}>
          {title}
        </h2>
      )}
      <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)" }}>
        {children}
      </div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.38)", margin: "0 0 8px" }}>
        {title}
      </h3>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.65)" }}>
        {children}
      </div>
    </div>
  );
}