<?php
/**
 * Plugin Name: Le Soft – Mode application iOS (Reader App)
 * Description: Retire les offres d'abonnement, les tarifs et les paiements des pages servies à l'application iOS (directive App Store 3.1.3(a)).
 * Version: 1.0.0
 *
 * Installation : copier ce fichier dans wp-content/mu-plugins/ (créer le dossier s'il n'existe pas).
 * Un « mu-plugin » est chargé automatiquement et ne peut pas être désactivé par erreur depuis l'admin.
 *
 * L'application iOS ajoute « LeSoftApp-iOS » à la fin de son User-Agent (WebView)
 * et envoie l'en-tête « X-LeSoft-App: ios » (flux RSS et pages lues en natif).
 */

if (!defined('ABSPATH')) {
	exit;
}

/** Vrai quand la requête vient de l'application iOS. */
function lesoft_is_ios_app() {
	static $is_app = null;
	if ($is_app === null) {
		$agent  = isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
		$header = isset($_SERVER['HTTP_X_LESOFT_APP']) ? (string) $_SERVER['HTTP_X_LESOFT_APP'] : '';
		$is_app = stripos($agent, 'LeSoftApp-iOS') !== false || strtolower($header) === 'ios';
	}
	return $is_app;
}

/** Pages d'achat : seul le premier segment de l'URL compte, pour ne pas bloquer un article dont le titre contient « abonnement ». */
function lesoft_is_purchase_url($url) {
	$path  = (string) wp_parse_url($url, PHP_URL_PATH);
	$query = (string) wp_parse_url($url, PHP_URL_QUERY);
	return (bool) preg_match('#^/(membership-join|s-abonner|abonnements?|tarifs?|offres?|pricing|checkout|cart|panier|boutique|shop|produits?|product|commande)(/|$)#i', $path)
		|| (bool) preg_match('/swpm_payment|swpm_paypal|add-to-cart/i', $query);
}

/** Vrai quand le lecteur est connecté (Simple Membership, sinon compte WordPress). */
function lesoft_reader_logged_in() {
	if (class_exists('SwpmMemberUtils') && method_exists('SwpmMemberUtils', 'is_member_logged_in')) {
		return SwpmMemberUtils::is_member_logged_in();
	}
	return is_user_logged_in();
}

/**
 * Vrai quand l'article est réservé aux abonnés.
 * À ADAPTER : vérifiez sur votre site laquelle de ces règles correspond à vos articles premium.
 */
function lesoft_is_premium_post($post_id) {
	$premium = false;
	if (class_exists('SwpmProtection') && method_exists('SwpmProtection', 'get_instance')) {
		$protection = SwpmProtection::get_instance();
		if (method_exists($protection, 'is_protected')) {
			$premium = (bool) $protection->is_protected($post_id);
		}
	}
	// Repli : mêmes catégories que l'application (« Réservé », « Premium », « Journal »).
	if (!$premium) {
		foreach (get_the_category($post_id) as $category) {
			if (preg_match('/réserv|reserv|premium|journal/i', $category->name . ' ' . $category->slug)) {
				$premium = true;
				break;
			}
		}
	}
	return (bool) apply_filters('lesoft_is_premium_post', $premium, $post_id);
}

/** URL de la page de connexion (sans aucun lien d'inscription). */
function lesoft_login_url() {
	return home_url('/membership-login/');
}

/* -------------------------------------------------------------------------
 * 1. Cache : ne jamais mélanger la version web et la version application.
 * ---------------------------------------------------------------------- */
add_action('send_headers', function () {
	header('Vary: User-Agent, X-LeSoft-App', false);
	if (lesoft_is_ios_app()) {
		// Empêche WP Rocket, LiteSpeed, W3 Total Cache… d'enregistrer la page filtrée.
		if (!defined('DONOTCACHEPAGE')) {
			define('DONOTCACHEPAGE', true);
		}
		nocache_headers();
		// Le CDN de l'hébergeur lit cet en-tête (il envoie « CDN-Cache-Control: maxage=31104000 » par défaut).
		header('CDN-Cache-Control: no-store');
	}
});

/* -------------------------------------------------------------------------
 * 2. Parcours verrouillé : pages d'achat et articles premium → connexion.
 * ---------------------------------------------------------------------- */
add_action('template_redirect', function () {
	if (!lesoft_is_ios_app()) {
		return;
	}
	$current = home_url(add_query_arg(array()));
	if (lesoft_is_purchase_url($current)) {
		wp_safe_redirect(lesoft_login_url(), 302);
		exit;
	}
	if (is_singular('post') && !lesoft_reader_logged_in() && lesoft_is_premium_post(get_queried_object_id())) {
		// L'application mémorise l'article et y revient après la connexion.
		wp_safe_redirect(lesoft_login_url(), 302);
		exit;
	}
});

/* -------------------------------------------------------------------------
 * 3. Filtrage côté serveur : le HTML envoyé à l'app ne contient pas d'offre.
 * ---------------------------------------------------------------------- */

// Menus : retire « S'abonner », « Nos offres », « Tarifs »…
add_filter('wp_nav_menu_objects', function ($items) {
	if (!lesoft_is_ios_app()) {
		return $items;
	}
	return array_values(array_filter($items, function ($item) {
		$classes = implode(' ', (array) $item->classes);
		return !lesoft_is_purchase_url($item->url)
			&& !preg_match('/abonn|subscribe|tarif|pricing/i', $item->title)
			&& strpos($classes, 'lesoft-no-app') === false;
	}));
});

// Shortcodes de paiement et d'inscription (boutons Simple Membership, grilles tarifaires…).
add_filter('pre_do_shortcode_tag', function ($output, $tag) {
	if (lesoft_is_ios_app() && preg_match('/payment|registration|pricing|checkout|buy_now|paypal/i', $tag)) {
		return '';
	}
	return $output;
}, 10, 2);

// Blocs Gutenberg : tout bloc qui porte la classe CSS « lesoft-no-app » n'est pas envoyé à l'app.
// (Dans l'éditeur : bloc → Avancé → Classe(s) CSS additionnelle(s) → lesoft-no-app)
add_filter('render_block', function ($content, $block) {
	if (lesoft_is_ios_app() && !empty($block['attrs']['className']) && strpos($block['attrs']['className'], 'lesoft-no-app') !== false) {
		return '';
	}
	return $content;
}, 10, 2);

// Classe sur <body> pour cibler l'app en CSS.
add_filter('body_class', function ($classes) {
	if (lesoft_is_ios_app()) {
		$classes[] = 'lesoft-ios-app';
	}
	return $classes;
});

// Filet de sécurité CSS pour les éléments ajoutés par le thème ou d'autres extensions.
add_action('wp_head', function () {
	if (!lesoft_is_ios_app()) {
		return;
	}
	echo '<style id="lesoft-ios-app">'
		. '.lesoft-no-app,.lesoft-pricing,.pricing-table,.subscription-plan,'
		. 'a[href*="membership-join"],a[href*="swpm_payment"],a[href*="checkout"],'
		. 'form[action*="swpm_payment"],form[action*="membership-join"]'
		. '{display:none!important}'
		. '</style>';
}, 99);
