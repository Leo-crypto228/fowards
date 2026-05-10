import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

export function ConditionsGenerales() {
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

      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", margin: "0 0 6px", letterSpacing: "-0.4px" }}>
        {"Conditions générales d’utilisation"}
      </h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "0 0 36px" }}>
        En vigueur au 10/05/2026
      </p>

      <Section>
        <p>
          {"Les présentes conditions générales d’utilisation (dites « CGU ») ont pour objet l’encadrement juridique des modalités de mise à disposition du site et des services par Léo Le Guillou, éditeur du site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>
          {" et de définir les conditions d’accès et d’utilisation des services par « l’Utilisateur »."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Les présentes CGU sont accessibles sur le site à la rubrique « CGU »."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Toute inscription ou utilisation du site implique l’acceptation sans aucune réserve ni restriction des présentes CGU par l’utilisateur. Lors de l’inscription sur le site via le Formulaire d’inscription, chaque utilisateur accepte expressément les présentes CGU en cochant la case précédant le texte suivant : « Je reconnais avoir lu et compris les CGU et je les accepte »."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"En cas de non-acceptation des CGU stipulées dans le présent contrat, l’Utilisateur se doit de renoncer à l’accès des services proposés par le site."}
        </p>
        <p style={{ marginTop: 12 }}>
          <span translate="no" className="notranslate">fowards.net</span>
          {" se réserve le droit de modifier unilatéralement et à tout moment le contenu des présentes CGU."}
        </p>
      </Section>

      <Section title="Article 1 : Les mentions légales">
        <p>
          {"L’édition et la direction de la publication du site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>
          {" est assurée par Léo Le Guillou, domicilié Druillat, l’Ain 01."}<br /><br />
          {"Numéro de téléphone : 0767913803"}<br />
          {"Adresse e-mail :"}{" "}
          <a href="mailto:neyvo.entreprise@gmail.com" style={{ color: "rgba(255,255,255,0.55)" }}>
            neyvo.entreprise@gmail.com
          </a>
        </p>
        <p style={{ marginTop: 12 }}>
          {"L’hébergeur du site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>
          {" est la société Cloudflare, dont le siège social est situé au 101 Townsend Street CA 94107 San Francisco, États-Unis, avec le numéro de téléphone : +1 650-319-8930."}
        </p>
      </Section>

      <Section title="Article 2 : Accès au site">
        <p>
          {"Le site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>
          {" permet à l’Utilisateur un accès gratuit aux services suivants :"}
        </p>
        <p style={{ marginTop: 12 }}>
          <span translate="no" className="notranslate">Fowards</span>
          {" est une plateforme en ligne permettant aux utilisateurs de partager du contenu, d’échanger et d’interagir autour de thématiques liées à l’entrepreneuriat, au développement personnel et aux expériences de vie."}
        </p>
        <p style={{ marginTop: 12 }}>{"Le site propose notamment :"}</p>
        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
          <li>{"la publication de contenus (textes, messages, réflexions) par les utilisateurs"}</li>
          <li>{"l’interaction entre utilisateurs (likes, commentaires, échanges)"}</li>
          <li>{"la consultation de contenus publiés par la communauté"}</li>
          <li>{"la création et la gestion d’un compte utilisateur"}</li>
          <li>{"des fonctionnalités visant à favoriser l’authenticité, le partage d’expérience et la motivation entre utilisateurs"}</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          {"La plateforme peut évoluer à tout moment, avec l’ajout, la modification ou la suppression de fonctionnalités."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Le site est accessible gratuitement en tout lieu à tout Utilisateur ayant un accès à Internet. Tous les frais supportés par l’Utilisateur pour accéder au service (matériel informatique, logiciels, connexion Internet, etc.) sont à sa charge."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"L’Utilisateur non membre n’a pas accès aux services réservés. Pour cela, il doit s’inscrire en remplissant le formulaire. En acceptant de s’inscrire aux services réservés, l’Utilisateur membre s’engage à fournir des informations sincères et exactes concernant son état civil et ses coordonnées, notamment son adresse email."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Pour accéder aux services, l’Utilisateur doit ensuite s’identifier à l’aide de son identifiant et de son mot de passe qui lui seront communiqués après son inscription."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Tout Utilisateur membre régulièrement inscrit pourra également solliciter sa désinscription en se rendant à la page dédiée sur son espace personnel. Celle-ci sera effective dans un délai raisonnable."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Tout événement dû à un cas de force majeure ayant pour conséquence un dysfonctionnement du site ou serveur n’engage pas la responsabilité de"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>.
          {" Dans ces cas, l’Utilisateur accepte ainsi ne pas tenir rigueur à l’éditeur de toute interruption ou suspension de service, même sans préavis."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"L’Utilisateur a la possibilité de contacter le site par messagerie électronique à l’adresse email de l’éditeur communiqué à l’Article 1."}
        </p>
      </Section>

      <Section title="Article 3 : Collecte des données">
        <p>
          {"Le site assure à l’Utilisateur une collecte et un traitement d’informations personnelles dans le respect de la vie privée conformément à la loi n°78-17 du 6 janvier 1978 relative à l’informatique, aux fichiers et aux libertés."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"En vertu de la loi Informatique et Libertés, en date du 6 janvier 1978, l’Utilisateur dispose d’un droit d’accès, de rectification, de suppression et d’opposition de ses données personnelles. L’Utilisateur exerce ce droit par mail :"}{" "}
          <a href="mailto:neyvo.entreprise@gmail.com" style={{ color: "rgba(255,255,255,0.55)" }}>
            neyvo.entreprise@gmail.com
          </a>
        </p>
      </Section>

      <Section title="Article 4 : Propriété intellectuelle">
        <p>
          {"Les marques, logos, signes ainsi que tous les contenus du site (textes, images, son…) font l’objet d’une protection par le Code de la propriété intellectuelle et plus particulièrement par le droit d’auteur."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"L’Utilisateur doit solliciter l’autorisation préalable du site pour toute reproduction, publication, copie des différents contenus. Il s’engage à une utilisation des contenus du site dans un cadre strictement privé, toute utilisation à des fins commerciales et publicitaires est strictement interdite."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Toute représentation totale ou partielle de ce site par quelque procédé que ce soit, sans l’autorisation expresse de l’exploitant du site Internet constituerait une contrefaçon sanctionnée par l’article L 335-2 et suivants du Code de la propriété intellectuelle."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Il est rappelé conformément à l’article L122-5 du Code de propriété intellectuelle que l’Utilisateur qui reproduit, copie ou publie le contenu protégé doit citer l’auteur et sa source."}
        </p>
      </Section>

      <Section title="Article 5 : Responsabilité">
        <p>
          {"Les sources des informations diffusées sur le site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>
          {" sont réputées fiables mais le site ne garantit pas qu’il soit exempt de défauts, d’erreurs ou d’omissions."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Les informations communiquées sont présentées à titre indicatif et général sans valeur contractuelle. Malgré des mises à jour régulières, le site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>
          {" ne peut être tenu responsable de la modification des dispositions administratives et juridiques survenant après la publication. De même, le site ne peut être tenu responsable de l’utilisation et de l’interprétation de l’information contenue dans ce site."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"L’Utilisateur s’assure de garder son mot de passe secret. Toute divulgation du mot de passe, quelle que soit sa forme, est interdite. Il assume les risques liés à l’utilisation de son identifiant et mot de passe. Le site décline toute responsabilité."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Le site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>
          {" ne peut être tenu pour responsable d’éventuels virus qui pourraient infecter l’ordinateur ou tout matériel informatique de l’Internaute, suite à une utilisation, à l’accès, ou au téléchargement provenant de ce site."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"La responsabilité du site ne peut être engagée en cas de force majeure ou du fait imprévisible et insurmontable d’un tiers."}
        </p>
      </Section>

      <Section title="Article 6 : Liens hypertextes">
        <p>
          {"Des liens hypertextes peuvent être présents sur le site. L’Utilisateur est informé qu’en cliquant sur ces liens, il sortira du site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>.
          {" Ce dernier n’a pas de contrôle sur les pages web sur lesquelles aboutissent ces liens et ne saurait, en aucun cas, être responsable de leur contenu."}
        </p>
      </Section>

      <Section title="Article 7 : Cookies">
        <p>
          {"L’Utilisateur est informé que lors de ses visites sur le site, un cookie peut s’installer automatiquement sur son logiciel de navigation."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Les cookies sont de petits fichiers stockés temporairement sur le disque dur de l’ordinateur de l’Utilisateur par votre navigateur et qui sont nécessaires à l’utilisation du site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>.
          {" Les cookies ne contiennent pas d’information personnelle et ne peuvent pas être utilisés pour identifier quelqu’un. Un cookie contient un identifiant unique, généré aléatoirement et donc anonyme. Certains cookies expirent à la fin de la visite de l’Utilisateur, d’autres restent."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"L’information contenue dans les cookies est utilisée pour améliorer le site"}{" "}
          <span translate="no" className="notranslate">fowards.net</span>.
        </p>
        <p style={{ marginTop: 12 }}>
          {"En naviguant sur le site, l’Utilisateur les accepte. L’Utilisateur doit toutefois donner son consentement quant à l’utilisation de certains cookies. À défaut d’acceptation, l’Utilisateur est informé que certaines fonctionnalités ou pages risquent de lui être refusées. L’Utilisateur pourra désactiver ces cookies par l’intermédiaire des paramètres figurant au sein de son logiciel de navigation."}
        </p>
      </Section>

      <Section title="Article 8 : Publication par l’Utilisateur">
        <p>
          {"Le site permet aux membres de publier les contenus suivants : œuvres originales, articles, actualités ou articles d’opinion, commentaires, réactions, discussions, forums."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Dans ses publications, le membre s’engage à respecter les règles de la Netiquette (règles de bonne conduite de l’internet) et les règles de droit en vigueur."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Le site peut exercer une modération sur les publications et se réserve le droit de refuser leur mise en ligne, sans avoir à s’en justifier auprès du membre."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Le membre reste titulaire de l’intégralité de ses droits de propriété intellectuelle. Mais en publiant une publication sur le site, il cède à la société éditrice le droit non exclusif et gratuit de représenter, reproduire, adapter, modifier, diffuser et distribuer sa publication, directement ou par un tiers autorisé, dans le monde entier, sur tout support (numérique ou physique), pour la durée de la propriété intellectuelle. Le membre cède notamment le droit d’utiliser sa publication sur internet et sur les réseaux de téléphonie mobile."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"La société éditrice s’engage à faire figurer le nom du membre à proximité de chaque utilisation de sa publication."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Tout contenu mis en ligne par l’Utilisateur est de sa seule responsabilité. L’Utilisateur s’engage à ne pas mettre en ligne de contenus pouvant porter atteinte aux intérêts de tierces personnes. Tout recours en justice engagé par un tiers lésé contre le site sera pris en charge par l’Utilisateur."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Le contenu de l’Utilisateur peut être à tout moment et pour n’importe quelle raison supprimé ou modifié par le site, sans préavis."}
        </p>
      </Section>

      <Section title="Article 9 : Droit applicable et juridiction compétente">
        <p>
          {"La législation française s’applique au présent contrat. En cas d’absence de résolution amiable d’un litige né entre les parties, les tribunaux français seront seuls compétents pour en connaître."}
        </p>
        <p style={{ marginTop: 12 }}>
          {"Pour toute question relative à l’application des présentes CGU, vous pouvez joindre l’éditeur aux coordonnées inscrites à l’Article 1."}
        </p>
      </Section>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", marginTop: 40 }}>
        {"CGU réalisées sur legalplace.fr"}
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