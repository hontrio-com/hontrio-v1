<?php
// =============================================
// Hontrio — miezul extensiei OpenCart, același pentru 3.0.x și 4.x.
// Contractul: docs/integrari/OPENCART.md (în depozitul Hontrio).
//
// - API-ul de citire: info, products, product_ids, orders, order_ids;
// - sursa vizitei (UTM, gclid / gbraid / wbraid), ținută în sesiune și salvată
//   pe comandă la plasare.
//
// Clasele n-au spațiu de nume: același fișier merge în OpenCart 3
// (system/library/hontrio/core.php) și în OpenCart 4
// (extension/hontrio/system/library/core.php). Scris pentru PHP 7.3+.
//
// ⚠ Din comenzi pleacă doar ce scrie în contract: nicio dată de identificare
// a cumpărătorului (din adresă doar codul țării).
// =============================================

if (!class_exists('HontrioApiError', false)) {
	/** O eroare cu răspuns: starea HTTP și codul din contract. */
	class HontrioApiError extends Exception {
		/** @var int */
		public $status;
		/** @var string */
		public $errorCode;

		public function __construct($status, $errorCode, $message) {
			parent::__construct($message);
			$this->status = (int)$status;
			$this->errorCode = (string)$errorCode;
		}
	}
}

if (!class_exists('HontrioCore', false)) {
	class HontrioCore {
		const API_VERSION = 1;
		const EXTENSION_VERSION = '1.0.0';
		const SETTING_CODE = 'module_hontrio';
		const TABLE = 'hontrio_order_source';

		/** Parametrii adresei care fac din vizită o vizită cu sursă. */
		const SOURCE_PARAMS = array('utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid');
		const SOURCE_MAX = 200;

		const PRODUCTS_LIMIT = 100;
		const PRODUCTS_MAX = 250;
		const ORDERS_LIMIT = 50;
		const ORDERS_MAX = 100;
		const IDS_LIMIT = 5000;
		const IDS_MAX = 5000;

		/** @var object */
		private $registry;
		/** @var object */
		private $db;
		/** @var object */
		private $config;
		/** @var bool */
		private $oc4;
		/** @var bool */
		private $oc41;
		/** @var int */
		private $storeId = 0;
		/** @var int */
		private $languageId = 0;
		/** @var string */
		private $languageCode = '';
		/** @var string */
		private $currency = '';
		/** @var DateTimeZone */
		private $timezone;
		/** @var array */
		private $columns = array();

		public function __construct($registry) {
			$this->registry = $registry;
			$this->db = $registry->get('db');
			$this->config = $registry->get('config');
			$version = defined('VERSION') ? VERSION : '0';
			$this->oc4 = version_compare($version, '4.0.0.0', '>=');
			$this->oc41 = version_compare($version, '4.1.0.0', '>=');
			$this->timezone = new DateTimeZone(date_default_timezone_get());
		}

		// ── Intrarea API-ului ───────────────────────────────────────────────

		/** Răspunde cererii curente (ruta extension/hontrio/api). */
		public function handle() {
			// Avertismentele PHP nu au ce căuta în JSON; ce s-a scris deja în tampon se aruncă
			$this->config->set('config_error_display', 0);
			@ini_set('display_errors', '0');
			if (ob_get_level() > 0) {
				@ob_clean();
			}

			try {
				$payload = $this->dispatch();
				$this->send(200, $payload);
			} catch (HontrioApiError $e) {
				$this->send($e->status, array('ok' => false, 'error' => array('code' => $e->errorCode, 'message' => $e->getMessage())));
			} catch (Exception $e) {
				$this->logError($e);
				$this->send(500, array('ok' => false, 'error' => array('code' => 'server_error', 'message' => 'The store could not read the data.')));
			} catch (Throwable $e) {
				$this->logError($e);
				$this->send(500, array('ok' => false, 'error' => array('code' => 'server_error', 'message' => 'The store could not read the data.')));
			}
		}

		private function dispatch() {
			$this->authorize();

			$request = $this->registry->get('request');
			$method = isset($request->server['REQUEST_METHOD']) ? strtoupper((string)$request->server['REQUEST_METHOD']) : 'GET';
			if ($method !== 'GET' && $method !== 'HEAD') {
				throw new HontrioApiError(400, 'bad_request', 'Use GET.');
			}

			$this->bootStore();

			$action = $this->param('action');
			switch ($action) {
				case 'info':
					return array('ok' => true, 'data' => $this->info());
				case 'products':
					return $this->products();
				case 'product_ids':
					return $this->productIds();
				case 'orders':
					return $this->orders();
				case 'order_ids':
					return $this->orderIds();
			}
			throw new HontrioApiError(400, 'bad_request', $action === null ? 'Missing parameter: action.' : 'Unknown action.');
		}

		/** Cheia din antetul X-Hontrio-Key, comparată în timp constant. */
		private function authorize() {
			$stored = (string)$this->config->get(self::SETTING_CODE . '_key');
			if (!preg_match('/^[0-9a-f]{48}$/', $stored)) {
				// Fișierele sunt pe server, dar modulul nu e instalat (sau nu mai e)
				throw new HontrioApiError(403, 'disabled', 'The Hontrio module is not installed. Install it from Extensions > Modules.');
			}

			$given = $this->header('X-Hontrio-Key');
			if ($given === null || $given === '' || !hash_equals($stored, $given)) {
				throw new HontrioApiError(401, 'unauthorized', 'Missing or wrong X-Hontrio-Key.');
			}

			if (!(int)$this->config->get(self::SETTING_CODE . '_status')) {
				throw new HontrioApiError(403, 'disabled', 'The Hontrio API is turned off in the extension settings.');
			}
		}

		private function send($status, array $payload) {
			$response = $this->registry->get('response');
			$request = $this->registry->get('request');

			$body = json_encode(array('hontrio_api' => self::API_VERSION) + $payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE);
			if ($body === false) {
				$status = 500;
				$body = '{"hontrio_api":' . self::API_VERSION . ',"ok":false,"error":{"code":"server_error","message":"The response could not be encoded."}}';
			}

			$reasons = array(200 => 'OK', 400 => 'Bad Request', 401 => 'Unauthorized', 403 => 'Forbidden', 500 => 'Internal Server Error');
			$protocol = isset($request->server['SERVER_PROTOCOL']) && preg_match('#^HTTP/\d(\.\d)?$#', (string)$request->server['SERVER_PROTOCOL']) ? $request->server['SERVER_PROTOCOL'] : 'HTTP/1.1';
			if ($status !== 200) {
				$response->addHeader($protocol . ' ' . $status . ' ' . (isset($reasons[$status]) ? $reasons[$status] : 'Error'));
			}
			$response->addHeader('Content-Type: application/json; charset=utf-8');
			$response->addHeader('Cache-Control: no-store');
			$response->addHeader('X-Robots-Tag: noindex, nofollow');
			$response->setOutput($body);
		}

		private function logError($e) {
			$log = $this->registry->get('log');
			if ($log) {
				$log->write('Hontrio API: ' . get_class($e) . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
			}
		}

		// ── Magazinul cerut: limba, moneda, fusul ───────────────────────────

		private function bootStore() {
			$this->storeId = (int)$this->config->get('config_store_id');

			// Limba implicită a magazinului (nu cea a vizitatorului): numele vin în ea
			$code = $this->storeSetting($this->oc41 ? 'config_language_catalog' : 'config_language');
			if ($code === null && $this->oc41) {
				$code = $this->storeSetting('config_language');
			}
			$language = null;
			if ($code !== null && $code !== '') {
				$query = $this->db->query("SELECT `language_id`, `code` FROM `" . DB_PREFIX . "language` WHERE `code` = '" . $this->db->escape($code) . "' LIMIT 1");
				$language = $query->num_rows ? $query->row : null;
			}
			if (!$language) {
				$query = $this->db->query("SELECT `language_id`, `code` FROM `" . DB_PREFIX . "language` WHERE `language_id` = '" . (int)$this->config->get('config_language_id') . "' LIMIT 1");
				$language = $query->num_rows ? $query->row : array('language_id' => (int)$this->config->get('config_language_id'), 'code' => (string)$this->config->get('config_language'));
			}
			$this->languageId = (int)$language['language_id'];
			$this->languageCode = (string)$language['code'];
			// Modelele OpenCart (produsul, legăturile SEO) citesc limba din config
			$this->config->set('config_language_id', $this->languageId);

			// Moneda în care OpenCart ține toate sumele: cea implicită a instalării (magazinul 0,
			// cursul 1). Un magazin secundar poate afișa altă monedă, dar sumele rămân în aceasta.
			$query = $this->db->query("SELECT `value` FROM `" . DB_PREFIX . "setting` WHERE `key` = 'config_currency' AND `store_id` = '0' LIMIT 1");
			$currency = $query->num_rows ? (string)$query->row['value'] : '';
			$this->currency = $currency !== '' ? $currency : (string)$this->config->get('config_currency');
		}

		/** O setare a magazinului cerut, altfel a celui principal (cum o ține OpenCart). */
		private function storeSetting($key) {
			$query = $this->db->query("SELECT `value` FROM `" . DB_PREFIX . "setting` WHERE `key` = '" . $this->db->escape($key) . "' AND `store_id` IN ('0', '" . (int)$this->storeId . "') ORDER BY `store_id` DESC LIMIT 1");
			return $query->num_rows ? (string)$query->row['value'] : null;
		}

		private function hasColumn($table, $column) {
			$key = $table . '.' . $column;
			if (!isset($this->columns[$key])) {
				$query = $this->db->query("SHOW COLUMNS FROM `" . DB_PREFIX . $table . "` LIKE '" . $this->db->escape($column) . "'");
				$this->columns[$key] = (bool)$query->num_rows;
			}
			return $this->columns[$key];
		}

		private function hasTable($table) {
			$key = $table . '.';
			if (!isset($this->columns[$key])) {
				$query = $this->db->query("SHOW TABLES LIKE '" . $this->db->escape(DB_PREFIX . $table) . "'");
				$this->columns[$key] = (bool)$query->num_rows;
			}
			return $this->columns[$key];
		}

		// ── info ────────────────────────────────────────────────────────────

		private function info() {
			$country = null;
			if ((int)$this->config->get('config_country_id')) {
				$query = $this->db->query("SELECT `iso_code_2` FROM `" . DB_PREFIX . "country` WHERE `country_id` = '" . (int)$this->config->get('config_country_id') . "' LIMIT 1");
				$country = $query->num_rows ? $this->text($query->row['iso_code_2']) : null;
			}

			$language = strtolower((string)preg_replace('/[-_].*$/', '', $this->languageCode));

			$products = $this->db->query("SELECT COUNT(DISTINCT p.`product_id`) AS `total`" . $this->listedFrom())->row['total'];
			$orders = $this->db->query("SELECT COUNT(*) AS `total` FROM `" . DB_PREFIX . "order` o WHERE o.`order_status_id` > '0' AND o.`store_id` = '" . (int)$this->storeId . "'")->row['total'];

			$processing = array_map('intval', (array)$this->config->get('config_processing_status'));
			$complete = array_map('intval', (array)$this->config->get('config_complete_status'));
			$statuses = array();
			foreach ($this->statusNames() as $id => $name) {
				$statuses[] = array('id' => (int)$id, 'name' => $name, 'processing' => in_array((int)$id, $processing, true), 'complete' => in_array((int)$id, $complete, true));
			}

			$tracking = (bool)(int)$this->config->get(self::SETTING_CODE . '_tracking');
			$since = (string)$this->config->get(self::SETTING_CODE . '_tracking_since');

			return array(
				'extension_version' => self::EXTENSION_VERSION,
				'opencart_version' => defined('VERSION') ? VERSION : null,
				'php_version' => PHP_VERSION,
				'store' => array(
					'id' => $this->storeId,
					'name' => $this->text($this->config->get('config_name')),
					'url' => rtrim($this->storeUrl(), '/'),
					'country' => $country !== null ? strtoupper($country) : null,
					'language' => $language !== '' ? $language : null,
					'currency' => $this->currency !== '' ? $this->currency : null,
					'timezone' => $this->timezone->getName(),
					'prices_include_tax' => (bool)(int)$this->config->get('config_tax'),
					'customer_group_id' => (int)$this->config->get('config_customer_group_id'),
				),
				'counts' => array('products' => (int)$products, 'orders' => (int)$orders),
				'statuses' => $statuses,
				'extensions' => $this->extensions(),
				'tracking' => array('enabled' => $tracking, 'since' => $tracking ? $this->iso($since) : null),
				'server_time' => (new DateTime('now', $this->timezone))->format('c'),
			);
		}

		/** Stările comenzilor, în limba implicită, după id. */
		private function statusNames() {
			$names = array();
			$query = $this->db->query("SELECT `order_status_id`, `name` FROM `" . DB_PREFIX . "order_status` WHERE `language_id` = '" . (int)$this->languageId . "' ORDER BY `order_status_id` ASC");
			foreach ($query->rows as $row) {
				$names[(int)$row['order_status_id']] = $this->text($row['name']);
			}
			return $names;
		}

		/** Extensiile instalate și pornite, de tip feed, analytics și module. */
		private function extensions() {
			$out = array('feed' => array(), 'analytics' => array(), 'module' => array());
			$query = $this->db->query("SELECT DISTINCT `type`, `code` FROM `" . DB_PREFIX . "extension` WHERE `type` IN ('feed', 'analytics', 'module') ORDER BY `type`, `code`");

			$instances = array();
			if ($this->hasTable('module')) {
				foreach ($this->db->query("SELECT `code`, `setting` FROM `" . DB_PREFIX . "module`")->rows as $row) {
					$setting = json_decode((string)$row['setting'], true);
					if (is_array($setting) && !empty($setting['status'])) {
						$instances[(string)$row['code']] = true;
					}
				}
			}

			foreach ($query->rows as $row) {
				$type = (string)$row['type'];
				$code = (string)$row['code'];
				if ((int)$this->config->get($type . '_' . $code . '_status') || ($type === 'module' && isset($instances[$code]))) {
					$out[$type][] = $code;
				}
			}
			return $out;
		}

		// ── Produsele ───────────────────────────────────────────────────────

		/** Produsele listate în magazinul cerut, ca în vitrină. */
		private function listedFrom() {
			return " FROM `" . DB_PREFIX . "product` p"
				. " INNER JOIN `" . DB_PREFIX . "product_to_store` p2s ON (p2s.`product_id` = p.`product_id` AND p2s.`store_id` = '" . (int)$this->storeId . "')"
				. " INNER JOIN `" . DB_PREFIX . "product_description` pd ON (pd.`product_id` = p.`product_id` AND pd.`language_id` = '" . (int)$this->languageId . "')"
				. " WHERE p.`status` = '1' AND p.`date_available` <= NOW()";
		}

		private function products() {
			$page = $this->pageParam();
			$limit = $this->limitParam(self::PRODUCTS_LIMIT, self::PRODUCTS_MAX);
			$where = '';
			$modified = $this->dateParam('modified_after');
			if ($modified !== null) {
				$where .= " AND p.`date_modified` >= '" . $this->db->escape($modified) . "'";
			}
			$ids = $this->idsParam(self::PRODUCTS_MAX);
			if ($ids !== null) {
				$where .= " AND p.`product_id` IN (" . implode(',', $ids) . ")";
			}

			$total = (int)$this->db->query("SELECT COUNT(DISTINCT p.`product_id`) AS `total`" . $this->listedFrom() . $where)->row['total'];
			$query = $this->db->query("SELECT DISTINCT p.`product_id`" . $this->listedFrom() . $where . " ORDER BY p.`product_id` ASC LIMIT " . (int)(($page - 1) * $limit) . ", " . (int)$limit);

			$list = array();
			foreach ($query->rows as $row) {
				$list[] = (int)$row['product_id'];
			}

			return array('ok' => true, 'data' => $this->productRows($list), 'meta' => $this->meta($page, $limit, $total));
		}

		private function productIds() {
			$page = $this->pageParam();
			$limit = $this->limitParam(self::IDS_LIMIT, self::IDS_MAX);
			$total = (int)$this->db->query("SELECT COUNT(DISTINCT p.`product_id`) AS `total`" . $this->listedFrom())->row['total'];
			$query = $this->db->query("SELECT DISTINCT p.`product_id`" . $this->listedFrom() . " ORDER BY p.`product_id` ASC LIMIT " . (int)(($page - 1) * $limit) . ", " . (int)$limit);
			$ids = array();
			foreach ($query->rows as $row) {
				$ids[] = (int)$row['product_id'];
			}
			return array('ok' => true, 'data' => $ids, 'meta' => $this->meta($page, $limit, $total));
		}

		/** Rândurile produselor, cu prețul calculat de modelul vitrinei (specialul, reducerea, taxele). */
		private function productRows(array $ids) {
			if (!$ids) {
				return array();
			}

			$load = $this->registry->get('load');
			$load->model('catalog/product');
			$model = $this->registry->get('model_catalog_product');
			$tax = $this->registry->get('tax');
			$url = $this->registry->get('url');
			$in = implode(',', array_map('intval', $ids));

			$manufacturers = array();
			$stockStatuses = array();
			foreach ($this->db->query("SELECT `stock_status_id`, `name` FROM `" . DB_PREFIX . "stock_status` WHERE `language_id` = '" . (int)$this->languageId . "'")->rows as $row) {
				$stockStatuses[(int)$row['stock_status_id']] = $this->text($row['name']);
			}

			$categories = $this->productCategories($in);
			$codes = $this->oc41 ? $this->productCodes($in) : array();
			$specialEnds = $this->specialEnds($in);
			$stockCheckout = (bool)(int)$this->config->get('config_stock_checkout');
			$imageBase = $this->imageBase();

			$rows = array();
			foreach ($ids as $id) {
				$product = $model->getProduct($id);
				if (!$product) {
					continue;
				}

				$manufacturerId = (int)$product['manufacturer_id'];
				if ($manufacturerId && !array_key_exists($manufacturerId, $manufacturers)) {
					$query = $this->db->query("SELECT `name` FROM `" . DB_PREFIX . "manufacturer` WHERE `manufacturer_id` = '" . $manufacturerId . "' LIMIT 1");
					$manufacturers[$manufacturerId] = $query->num_rows ? $this->text($query->row['name']) : null;
				}

				// Prețul pentru o bucată, ca în pagina produsului: specialul activ, altfel reducerea de cantitate 1, altfel prețul
				$base = (float)$product['price'];
				$special = isset($product['special']) ? (float)$product['special'] : 0.0;
				$net = $special ? $special : $base;
				$regularNet = $special && $base > $special ? $base : null;
				$taxClass = (int)$product['tax_class_id'];
				$gross = (float)$tax->calculate($net, $taxClass, true);
				$quantity = (int)$product['quantity'];

				// OpenCart 3 dă numele stării de stoc (în limba din config), OpenCart 4 id-ul ei
				if (isset($product['stock_status_id'])) {
					$stockStatus = isset($stockStatuses[(int)$product['stock_status_id']]) ? $stockStatuses[(int)$product['stock_status_id']] : null;
				} else {
					$stockStatus = isset($product['stock_status']) ? $this->text($product['stock_status']) : null;
				}

				if ($this->oc41) {
					$code = isset($codes[$id]) ? $codes[$id] : array();
				} else {
					$code = array();
					foreach (array('sku', 'upc', 'ean', 'jan', 'isbn', 'mpn') as $field) {
						$code[$field] = isset($product[$field]) ? $product[$field] : null;
					}
				}

				$rows[] = array(
					'product_id' => (int)$id,
					'master_id' => isset($product['master_id']) ? (int)$product['master_id'] : 0,
					'variant' => $this->oc4 && !empty($product['master_id']) ? $this->variantOptions(isset($product['variant']) ? $product['variant'] : null, isset($product['override']) ? $product['override'] : null) : null,
					'name' => $this->text($product['name']),
					'model' => $this->text($product['model']),
					'sku' => $this->text(isset($code['sku']) ? $code['sku'] : null),
					'upc' => $this->text(isset($code['upc']) ? $code['upc'] : null),
					'ean' => $this->text(isset($code['ean']) ? $code['ean'] : null),
					'jan' => $this->text(isset($code['jan']) ? $code['jan'] : null),
					'isbn' => $this->text(isset($code['isbn']) ? $code['isbn'] : null),
					'mpn' => $this->text(isset($code['mpn']) ? $code['mpn'] : null),
					'url' => $this->productUrl($url, $id),
					'image' => $this->imageUrl($imageBase, isset($product['image']) ? $product['image'] : ''),
					'manufacturer' => $manufacturerId ? $manufacturers[$manufacturerId] : null,
					'categories' => isset($categories[$id]) ? $categories[$id] : array(),
					'price' => $this->money($gross),
					'price_net' => $this->money($net),
					'regular_price' => $regularNet !== null ? $this->money((float)$tax->calculate($regularNet, $taxClass, true)) : null,
					'regular_price_net' => $regularNet !== null ? $this->money($regularNet) : null,
					'special_ends' => $special && isset($specialEnds[$id]) ? $specialEnds[$id] : null,
					'tax_rate' => $net > 0 ? round(($gross / $net - 1) * 100, 2) : 0.0,
					'quantity' => $quantity,
					'subtract' => (bool)(int)$product['subtract'],
					'available' => $quantity > 0 || $stockCheckout,
					'stock_status' => $quantity <= 0 ? $stockStatus : null,
					'date_added' => $this->iso($product['date_added']),
					'date_modified' => $this->iso($product['date_modified']),
				);
			}
			return $rows;
		}

		/** Căile categoriilor (rădăcină → frunză), doar categoriile pornite ale magazinului cerut. */
		private function productCategories($in) {
			$query = $this->db->query("SELECT p2c.`product_id`, p2c.`category_id`, cp.`level`, cd.`name`"
				. " FROM `" . DB_PREFIX . "product_to_category` p2c"
				. " INNER JOIN `" . DB_PREFIX . "category` c ON (c.`category_id` = p2c.`category_id` AND c.`status` = '1')"
				. " INNER JOIN `" . DB_PREFIX . "category_to_store` c2s ON (c2s.`category_id` = p2c.`category_id` AND c2s.`store_id` = '" . (int)$this->storeId . "')"
				. " INNER JOIN `" . DB_PREFIX . "category_path` cp ON (cp.`category_id` = p2c.`category_id`)"
				. " INNER JOIN `" . DB_PREFIX . "category_description` cd ON (cd.`category_id` = cp.`path_id` AND cd.`language_id` = '" . (int)$this->languageId . "')"
				. " WHERE p2c.`product_id` IN (" . $in . ")"
				. " ORDER BY p2c.`product_id` ASC, p2c.`category_id` ASC, cp.`level` ASC");
			$paths = array();
			foreach ($query->rows as $row) {
				$paths[(int)$row['product_id']][(int)$row['category_id']][] = $this->text($row['name']);
			}
			$out = array();
			foreach ($paths as $productId => $byCategory) {
				$out[$productId] = array_values(array_map(function ($names) {
					return array_values(array_filter($names, function ($name) {
						return $name !== null;
					}));
				}, $byCategory));
			}
			return $out;
		}

		/** OpenCart 4.1: codurile produsului (SKU, EAN...) stau în product_code. */
		private function productCodes($in) {
			$out = array();
			if (!$this->hasTable('product_code')) {
				return $out;
			}
			$query = $this->db->query("SELECT `product_id`, `code`, `value` FROM `" . DB_PREFIX . "product_code` WHERE `product_id` IN (" . $in . ") ORDER BY `product_code_id` ASC");
			foreach ($query->rows as $row) {
				$field = strtolower((string)$row['code']);
				$id = (int)$row['product_id'];
				if (!isset($out[$id][$field]) && $this->text($row['value']) !== null) {
					$out[$id][$field] = $row['value'];
				}
			}
			return $out;
		}

		/** Data de final a specialului activ, aleasă la fel ca prețul lui (prioritate, apoi preț). */
		private function specialEnds($in) {
			$group = (int)$this->config->get('config_customer_group_id');
			if ($this->oc41) {
				$sql = "SELECT `product_id`, `date_end` FROM `" . DB_PREFIX . "product_discount` WHERE `product_id` IN (" . $in . ") AND `customer_group_id` = '" . $group . "' AND `quantity` = '1' AND `special` = '1'";
			} else {
				$sql = "SELECT `product_id`, `date_end` FROM `" . DB_PREFIX . "product_special` WHERE `product_id` IN (" . $in . ") AND `customer_group_id` = '" . $group . "'";
			}
			$sql .= " AND ((`date_start` = '0000-00-00' OR `date_start` < NOW()) AND (`date_end` = '0000-00-00' OR `date_end` > NOW())) ORDER BY `product_id` ASC, `priority` ASC, `price` ASC";

			$out = array();
			foreach ($this->db->query($sql)->rows as $row) {
				$id = (int)$row['product_id'];
				if (!array_key_exists($id, $out)) {
					$end = (string)$row['date_end'];
					$out[$id] = $end !== '' && $end !== '0000-00-00' ? substr($end, 0, 10) : null;
				}
			}
			return $out;
		}

		/**
		 * OpenCart 4: opțiunile care definesc varianta, ca [{name, value}].
		 * `variant` ține valorile tuturor opțiunilor din formular; cele care chiar
		 * definesc varianta sunt cele bifate în `override[variant]` (vitrina le ascunde).
		 */
		private function variantOptions($variant, $override) {
			if (is_string($variant)) {
				$variant = $variant !== '' ? json_decode($variant, true) : array();
			}
			if (is_string($override)) {
				$override = $override !== '' ? json_decode($override, true) : array();
			}
			if (!is_array($variant) || !$variant) {
				return null;
			}
			if (is_array($override)) {
				$variant = isset($override['variant']) && is_array($override['variant']) ? array_intersect_key($variant, $override['variant']) : array();
			}

			$out = array();
			foreach ($variant as $productOptionId => $value) {
				$query = $this->db->query("SELECT o.`type`, od.`name` FROM `" . DB_PREFIX . "product_option` po"
					. " LEFT JOIN `" . DB_PREFIX . "option` o ON (o.`option_id` = po.`option_id`)"
					. " LEFT JOIN `" . DB_PREFIX . "option_description` od ON (od.`option_id` = po.`option_id` AND od.`language_id` = '" . (int)$this->languageId . "')"
					. " WHERE po.`product_option_id` = '" . (int)$productOptionId . "' LIMIT 1");
				if (!$query->num_rows) {
					continue;
				}
				$name = $this->text($query->row['name']);
				$values = is_array($value) ? $value : array($value);
				$labels = array();
				foreach ($values as $one) {
					if (in_array($query->row['type'], array('select', 'radio', 'checkbox', 'image'), true)) {
						$label = $this->db->query("SELECT ovd.`name` FROM `" . DB_PREFIX . "product_option_value` pov"
							. " LEFT JOIN `" . DB_PREFIX . "option_value_description` ovd ON (ovd.`option_value_id` = pov.`option_value_id` AND ovd.`language_id` = '" . (int)$this->languageId . "')"
							. " WHERE pov.`product_option_value_id` = '" . (int)$one . "' LIMIT 1");
						$text = $label->num_rows ? $this->text($label->row['name']) : null;
					} else {
						$text = $this->text(is_scalar($one) ? (string)$one : null);
					}
					if ($text !== null) {
						$labels[] = $text;
					}
				}
				if ($name !== null && $labels) {
					$out[] = array('name' => $name, 'value' => implode(', ', $labels));
				}
			}
			return $out ? $out : null;
		}

		private function productUrl($url, $id) {
			if ($this->oc4) {
				$link = $url->link('product/product', 'language=' . $this->languageCode . '&product_id=' . (int)$id);
			} else {
				$link = $url->link('product/product', 'product_id=' . (int)$id);
			}
			return str_replace('&amp;', '&', (string)$link);
		}

		/** Adresa de bază a magazinului (cu / la final). */
		private function storeUrl() {
			if (!$this->oc4 && $this->config->get('config_secure') && $this->config->get('config_ssl')) {
				return (string)$this->config->get('config_ssl');
			}
			return (string)$this->config->get('config_url');
		}

		/** Baza imaginilor, ca în modelul de imagini al vitrinei. */
		private function imageBase() {
			if (!$this->oc4) {
				$request = $this->registry->get('request');
				$https = !empty($request->server['HTTPS']) && strtolower((string)$request->server['HTTPS']) !== 'off';
				$base = $https && $this->config->get('config_ssl') ? $this->config->get('config_ssl') : $this->config->get('config_url');
				return rtrim((string)$base, '/') . '/';
			}
			return rtrim((string)$this->config->get('config_url'), '/') . '/';
		}

		private function imageUrl($base, $image) {
			$image = html_entity_decode((string)$image, ENT_QUOTES, 'UTF-8');
			if ($image === '') {
				return null;
			}
			$parts = array_map('rawurlencode', explode('/', ltrim(str_replace('\\', '/', $image), '/')));
			return $base . 'image/' . implode('/', $parts);
		}

		// ── Comenzile ───────────────────────────────────────────────────────

		private function orderWhere(array $filters) {
			$where = " WHERE o.`order_status_id` > '0' AND o.`store_id` = '" . (int)$this->storeId . "'";
			if (!empty($filters['created_after'])) {
				$where .= " AND o.`date_added` >= '" . $this->db->escape($filters['created_after']) . "'";
			}
			if (!empty($filters['modified_after'])) {
				$where .= " AND o.`date_modified` >= '" . $this->db->escape($filters['modified_after']) . "'";
			}
			if (!empty($filters['ids'])) {
				$where .= " AND o.`order_id` IN (" . implode(',', $filters['ids']) . ")";
			}
			return $where;
		}

		private function orders() {
			$page = $this->pageParam();
			$limit = $this->limitParam(self::ORDERS_LIMIT, self::ORDERS_MAX);
			$where = $this->orderWhere(array(
				'created_after' => $this->dateParam('created_after'),
				'modified_after' => $this->dateParam('modified_after'),
				'ids' => $this->idsParam(self::ORDERS_MAX),
			));

			$total = (int)$this->db->query("SELECT COUNT(*) AS `total` FROM `" . DB_PREFIX . "order` o" . $where)->row['total'];
			$paymentCode = $this->hasColumn('order', 'payment_code') ? ", o.`payment_code`" : '';
			$query = $this->db->query("SELECT o.`order_id`, o.`invoice_no`, o.`invoice_prefix`, o.`order_status_id`, o.`date_added`, o.`date_modified`,"
				. " o.`currency_code`, o.`currency_value`, o.`total`, o.`payment_method`" . $paymentCode . ", o.`shipping_method`,"
				. " o.`payment_country_id`, o.`shipping_country_id`, o.`marketing_id`, o.`tracking`"
				. " FROM `" . DB_PREFIX . "order` o" . $where
				. " ORDER BY o.`order_id` ASC LIMIT " . (int)(($page - 1) * $limit) . ", " . (int)$limit);

			return array('ok' => true, 'data' => $this->orderRows($query->rows), 'meta' => $this->meta($page, $limit, $total));
		}

		private function orderIds() {
			$page = $this->pageParam();
			$limit = $this->limitParam(self::IDS_LIMIT, self::IDS_MAX);
			$where = $this->orderWhere(array('created_after' => $this->dateParam('created_after')));
			$total = (int)$this->db->query("SELECT COUNT(*) AS `total` FROM `" . DB_PREFIX . "order` o" . $where)->row['total'];
			$query = $this->db->query("SELECT o.`order_id` FROM `" . DB_PREFIX . "order` o" . $where . " ORDER BY o.`order_id` ASC LIMIT " . (int)(($page - 1) * $limit) . ", " . (int)$limit);
			$ids = array();
			foreach ($query->rows as $row) {
				$ids[] = (int)$row['order_id'];
			}
			return array('ok' => true, 'data' => $ids, 'meta' => $this->meta($page, $limit, $total));
		}

		private function orderRows(array $orders) {
			if (!$orders) {
				return array();
			}
			$ids = array();
			$countryIds = array();
			foreach ($orders as $order) {
				$ids[] = (int)$order['order_id'];
				$countryIds[(int)$order['payment_country_id']] = true;
				$countryIds[(int)$order['shipping_country_id']] = true;
			}
			$in = implode(',', $ids);
			unset($countryIds[0]);

			$statuses = $this->statusNames();

			$countries = array();
			if ($countryIds) {
				$query = $this->db->query("SELECT `country_id`, `iso_code_2` FROM `" . DB_PREFIX . "country` WHERE `country_id` IN (" . implode(',', array_keys($countryIds)) . ")");
				foreach ($query->rows as $row) {
					$iso = $this->text($row['iso_code_2']);
					$countries[(int)$row['country_id']] = $iso !== null ? strtoupper($iso) : null;
				}
			}

			$totals = array();
			foreach ($this->db->query("SELECT `order_id`, `code`, `title`, `value` FROM `" . DB_PREFIX . "order_total` WHERE `order_id` IN (" . $in . ") ORDER BY `order_id` ASC, `sort_order` ASC, `order_total_id` ASC")->rows as $row) {
				$totals[(int)$row['order_id']][] = array('code' => (string)$row['code'], 'title' => $this->text($row['title']), 'value' => $this->money((float)$row['value']));
			}

			$options = array();
			foreach ($this->db->query("SELECT `order_product_id`, `name`, `value` FROM `" . DB_PREFIX . "order_option` WHERE `order_id` IN (" . $in . ") ORDER BY `order_option_id` ASC")->rows as $row) {
				$options[(int)$row['order_product_id']][] = array('name' => $this->text($row['name']), 'value' => $this->text($row['value']));
			}

			$masterColumn = $this->hasColumn('order_product', 'master_id') ? ', `master_id`' : '';
			$products = array();
			foreach ($this->db->query("SELECT `order_product_id`, `order_id`, `product_id`" . $masterColumn . ", `name`, `model`, `quantity`, `price`, `tax`, `total` FROM `" . DB_PREFIX . "order_product` WHERE `order_id` IN (" . $in . ") ORDER BY `order_id` ASC, `order_product_id` ASC")->rows as $row) {
				$products[(int)$row['order_id']][] = array(
					'order_product_id' => (int)$row['order_product_id'],
					'product_id' => (int)$row['product_id'],
					'master_id' => isset($row['master_id']) ? (int)$row['master_id'] : 0,
					'name' => $this->text($row['name']),
					'model' => $this->text($row['model']),
					'quantity' => (int)$row['quantity'],
					'price' => $this->money((float)$row['price']),
					'tax' => $this->money((float)$row['tax']),
					'total' => $this->money((float)$row['total']),
					'options' => isset($options[(int)$row['order_product_id']]) ? $options[(int)$row['order_product_id']] : array(),
				);
			}

			$coupons = array();
			if ($this->hasTable('coupon_history')) {
				$query = $this->db->query("SELECT ch.`order_id`, c.`code` FROM `" . DB_PREFIX . "coupon_history` ch LEFT JOIN `" . DB_PREFIX . "coupon` c ON (c.`coupon_id` = ch.`coupon_id`) WHERE ch.`order_id` IN (" . $in . ") ORDER BY ch.`coupon_history_id` ASC");
				foreach ($query->rows as $row) {
					$code = $this->text($row['code']);
					if ($code !== null && !isset($coupons[(int)$row['order_id']])) {
						$coupons[(int)$row['order_id']] = $code;
					}
				}
			}

			$sources = array();
			if ($this->hasTable(self::TABLE)) {
				foreach ($this->db->query("SELECT `order_id`, `source` FROM `" . DB_PREFIX . self::TABLE . "` WHERE `order_id` IN (" . $in . ")")->rows as $row) {
					$source = json_decode((string)$row['source'], true);
					if (is_array($source)) {
						$sources[(int)$row['order_id']] = self::sourceShape($source);
					}
				}
			}

			$rows = array();
			foreach ($orders as $order) {
				$id = (int)$order['order_id'];
				$payment = $this->method($order['payment_method'], isset($order['payment_code']) ? $order['payment_code'] : null);
				$shipping = $this->method($order['shipping_method'], null);
				$orderTotals = isset($totals[$id]) ? $totals[$id] : array();

				$coupon = isset($coupons[$id]) ? $coupons[$id] : null;
				if ($coupon === null) {
					// Comenzile încă neconfirmate n-au rând în coupon_history: codul e în titlul totalului
					foreach ($orderTotals as $line) {
						if ($line['code'] === 'coupon' && $line['title'] !== null && preg_match('/\(([^()]+)\)\s*$/u', $line['title'], $m)) {
							$coupon = trim($m[1]);
							break;
						}
					}
				}

				$countryId = (int)$order['payment_country_id'] ? (int)$order['payment_country_id'] : (int)$order['shipping_country_id'];
				$invoice = (int)$order['invoice_no'] ? $this->text($order['invoice_prefix']) . (int)$order['invoice_no'] : null;

				$rows[] = array(
					'order_id' => $id,
					'invoice' => $invoice !== null && $invoice !== '' ? $invoice : null,
					'status_id' => (int)$order['order_status_id'],
					'status' => isset($statuses[(int)$order['order_status_id']]) ? $statuses[(int)$order['order_status_id']] : null,
					'date_added' => $this->iso($order['date_added']),
					'date_modified' => $this->iso($order['date_modified']),
					'currency' => $this->currency !== '' ? $this->currency : null,
					'currency_code' => $this->text($order['currency_code']),
					'currency_value' => (float)$order['currency_value'],
					'total' => $this->money((float)$order['total']),
					'totals' => $orderTotals,
					'payment_method' => $payment['name'],
					'payment_code' => $payment['code'],
					'shipping_method' => $shipping['name'],
					'country' => $countryId && isset($countries[$countryId]) ? $countries[$countryId] : null,
					'coupon' => $coupon !== '' ? $coupon : null,
					'marketing_id' => (int)$order['marketing_id'],
					'tracking' => $this->text($order['tracking']),
					'products' => isset($products[$id]) ? $products[$id] : array(),
					'source' => isset($sources[$id]) ? $sources[$id] : null,
				);
			}
			return $rows;
		}

		/**
		 * Metoda de plată sau de livrare: OpenCart 3 ține numele (și codul separat),
		 * OpenCart 4.0.2+ ține un JSON {name, code}.
		 */
		private function method($value, $code) {
			$value = (string)$value;
			$decoded = $value !== '' && $value[0] === '{' ? json_decode($value, true) : null;
			if (is_array($decoded)) {
				return array(
					'name' => isset($decoded['name']) ? $this->text($decoded['name']) : null,
					'code' => isset($decoded['code']) ? $this->text($decoded['code']) : null,
				);
			}
			return array('name' => $this->text($value), 'code' => $this->text($code));
		}

		// ── Sursa vizitei ───────────────────────────────────────────────────

		/** Forma din contract: toate cheile, valorile lipsă = null. */
		public static function sourceShape(array $source) {
			$out = array();
			foreach (self::SOURCE_PARAMS as $key) {
				$out[$key] = isset($source[$key]) && is_string($source[$key]) && $source[$key] !== '' ? $source[$key] : null;
			}
			foreach (array('referrer', 'landing_path', 'captured_at') as $key) {
				$out[$key] = isset($source[$key]) && is_string($source[$key]) && $source[$key] !== '' ? $source[$key] : null;
			}
			return $out;
		}

		/** Evenimentul dinaintea antetului vitrinei: o vizită cu parametri își pune sursa în sesiune. */
		public function captureSource() {
			if (!(int)$this->config->get(self::SETTING_CODE . '_tracking') || !(string)$this->config->get(self::SETTING_CODE . '_key')) {
				return;
			}
			$request = $this->registry->get('request');
			$session = $this->registry->get('session');
			if (!$request || !$session) {
				return;
			}

			$values = array();
			foreach (self::SOURCE_PARAMS as $key) {
				if (isset($request->get[$key]) && is_scalar($request->get[$key])) {
					$value = trim(html_entity_decode((string)$request->get[$key], ENT_QUOTES, 'UTF-8'));
					if ($value !== '') {
						$values[$key] = self::cut($value, self::SOURCE_MAX);
					}
				}
			}
			if (!$values) {
				return;
			}

			$referrer = null;
			if (!empty($request->server['HTTP_REFERER'])) {
				$parts = parse_url(html_entity_decode((string)$request->server['HTTP_REFERER'], ENT_QUOTES, 'UTF-8'));
				if (is_array($parts) && isset($parts['scheme'], $parts['host']) && in_array(strtolower($parts['scheme']), array('http', 'https'), true)) {
					$referrer = strtolower($parts['scheme']) . '://' . strtolower($parts['host']) . (isset($parts['port']) ? ':' . (int)$parts['port'] : '');
				}
			}

			$path = null;
			if (!empty($request->server['REQUEST_URI'])) {
				$path = parse_url(html_entity_decode((string)$request->server['REQUEST_URI'], ENT_QUOTES, 'UTF-8'), PHP_URL_PATH);
				$path = is_string($path) && $path !== '' ? self::cut($path, self::SOURCE_MAX) : null;
			}

			$values['referrer'] = $referrer !== null ? self::cut($referrer, self::SOURCE_MAX) : null;
			$values['landing_path'] = $path;
			$values['captured_at'] = (new DateTime('now', $this->timezone))->format('c');
			$session->data['hontrio_source'] = self::sourceShape($values);
		}

		/**
		 * După addOrder / editOrder: sursa din sesiune ajunge pe comandă.
		 * La editOrder doar dacă respectiva comandă nu are încă una.
		 */
		public function saveOrderSource($orderId, $onlyIfMissing) {
			$orderId = (int)$orderId;
			if ($orderId <= 0 || !(int)$this->config->get(self::SETTING_CODE . '_tracking')) {
				return;
			}
			$session = $this->registry->get('session');
			if (!$session || empty($session->data['hontrio_source']) || !is_array($session->data['hontrio_source'])) {
				return;
			}
			if (!$this->hasTable(self::TABLE)) {
				return;
			}
			$json = json_encode(self::sourceShape($session->data['hontrio_source']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
			if ($json === false) {
				return;
			}
			$sql = ($onlyIfMissing ? "INSERT IGNORE INTO" : "REPLACE INTO") . " `" . DB_PREFIX . self::TABLE . "` SET `order_id` = '" . $orderId . "', `source` = '" . $this->db->escape($json) . "', `date_added` = NOW()";
			$this->db->query($sql);
		}

		/** Tabelul sursei (la instalarea modulului). */
		public static function createTable($db) {
			$db->query("CREATE TABLE IF NOT EXISTS `" . DB_PREFIX . self::TABLE . "` (`order_id` INT(11) NOT NULL, `source` TEXT NOT NULL, `date_added` DATETIME NOT NULL, PRIMARY KEY (`order_id`)) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
		}

		public static function dropTable($db) {
			$db->query("DROP TABLE IF EXISTS `" . DB_PREFIX . self::TABLE . "`");
		}

		/** Cheia nouă: 48 de caractere hexazecimale. */
		public static function newKey() {
			return bin2hex(random_bytes(24));
		}

		// ── Parametri și forme ──────────────────────────────────────────────

		private function param($name) {
			$request = $this->registry->get('request');
			if (!isset($request->get[$name])) {
				return null;
			}
			$value = $request->get[$name];
			if (!is_scalar($value)) {
				throw new HontrioApiError(400, 'bad_request', 'Invalid parameter: ' . $name . '.');
			}
			return trim(html_entity_decode((string)$value, ENT_QUOTES, 'UTF-8'));
		}

		private function pageParam() {
			$value = $this->param('page');
			if ($value === null || $value === '') {
				return 1;
			}
			if (!preg_match('/^[0-9]{1,9}$/', $value) || (int)$value < 1) {
				throw new HontrioApiError(400, 'bad_request', 'Invalid parameter: page (an integer from 1).');
			}
			return (int)$value;
		}

		private function limitParam($default, $max) {
			$value = $this->param('limit');
			if ($value === null || $value === '') {
				return $default;
			}
			if (!preg_match('/^[0-9]{1,9}$/', $value) || (int)$value < 1 || (int)$value > $max) {
				throw new HontrioApiError(400, 'bad_request', 'Invalid parameter: limit (an integer from 1 to ' . $max . ').');
			}
			return (int)$value;
		}

		/** O dată ISO 8601, întoarsă în ora magazinului ('Y-m-d H:i:s'), cum sunt datele în baza OpenCart. */
		private function dateParam($name) {
			$value = $this->param($name);
			if ($value === null || $value === '') {
				return null;
			}
			if (!preg_match('/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)?)?$/i', $value)) {
				throw new HontrioApiError(400, 'bad_request', 'Invalid parameter: ' . $name . ' (an ISO 8601 date).');
			}
			try {
				$date = new DateTime($value, $this->timezone);
			} catch (Exception $e) {
				throw new HontrioApiError(400, 'bad_request', 'Invalid parameter: ' . $name . ' (an ISO 8601 date).');
			}
			$errors = DateTime::getLastErrors();
			if (is_array($errors) && ($errors['warning_count'] || $errors['error_count'])) {
				throw new HontrioApiError(400, 'bad_request', 'Invalid parameter: ' . $name . ' (an ISO 8601 date).');
			}
			$date->setTimezone($this->timezone);
			return $date->format('Y-m-d H:i:s');
		}

		private function idsParam($max) {
			$value = $this->param('ids');
			if ($value === null || $value === '') {
				return null;
			}
			$ids = array();
			foreach (explode(',', $value) as $part) {
				$part = trim($part);
				if (!preg_match('/^[0-9]{1,10}$/', $part) || (int)$part < 1) {
					throw new HontrioApiError(400, 'bad_request', 'Invalid parameter: ids (comma-separated positive integers).');
				}
				$ids[(int)$part] = (int)$part;
			}
			if (count($ids) > $max) {
				throw new HontrioApiError(400, 'bad_request', 'Invalid parameter: ids (at most ' . $max . ').');
			}
			return array_values($ids);
		}

		private function meta($page, $limit, $total) {
			return array('page' => (int)$page, 'limit' => (int)$limit, 'total' => (int)$total, 'pages' => $total > 0 ? (int)ceil($total / $limit) : 0);
		}

		/** Un antet al cererii (OpenCart curăță $_SERVER cu htmlspecialchars; cheia e hex, nu se schimbă). */
		private function header($name) {
			$request = $this->registry->get('request');
			$key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
			if (isset($request->server[$key])) {
				return trim((string)$request->server[$key]);
			}
			if (isset($_SERVER[$key])) {
				return trim((string)$_SERVER[$key]);
			}
			if (function_exists('getallheaders')) {
				foreach ((array)getallheaders() as $header => $value) {
					if (strcasecmp((string)$header, $name) === 0) {
						return trim((string)$value);
					}
				}
			}
			return null;
		}

		/** Textul din baza OpenCart (salvat cu entități HTML), curat; gol → null. */
		private function text($value) {
			if ($value === null || is_array($value)) {
				return null;
			}
			$value = trim(html_entity_decode((string)$value, ENT_QUOTES, 'UTF-8'));
			return $value === '' ? null : $value;
		}

		private function money($value) {
			return round((float)$value, 4);
		}

		/** O dată din baza OpenCart (ora magazinului) ca ISO 8601 cu fusul orar. */
		private function iso($value) {
			$value = trim((string)$value);
			if ($value === '' || strpos($value, '0000-00-00') === 0) {
				return null;
			}
			try {
				$date = new DateTime($value, $this->timezone);
			} catch (Exception $e) {
				return null;
			}
			return $date->setTimezone($this->timezone)->format('c');
		}

		private static function cut($value, $max) {
			if (function_exists('mb_substr')) {
				return mb_substr($value, 0, $max, 'UTF-8');
			}
			return substr($value, 0, $max);
		}
	}
}
