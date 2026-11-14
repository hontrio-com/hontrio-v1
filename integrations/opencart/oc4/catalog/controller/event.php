<?php
// =============================================
// Hontrio — evenimentele vitrinei (OpenCart 4.x):
// - înaintea antetului: o vizită cu UTM / gclid își pune sursa în sesiune;
// - după addOrder / editOrder: sursa din sesiune se salvează pe comandă.
// Parametrii au valori implicite: chemată direct dintr-o adresă, metoda nu face nimic rău.
// =============================================
namespace Opencart\Catalog\Controller\Extension\Hontrio;

class Event extends \Opencart\System\Engine\Controller {
	public function header(string &$route = '', array &$args = []): void {
		require_once DIR_EXTENSION . 'hontrio/system/library/core.php';

		$core = new \HontrioCore($this->registry);
		$core->captureSource();
	}

	public function addOrder(string &$route = '', array &$args = [], mixed &$output = null): void {
		require_once DIR_EXTENSION . 'hontrio/system/library/core.php';

		$core = new \HontrioCore($this->registry);
		$core->saveOrderSource(is_numeric($output) ? (int)$output : 0, false);
	}

	public function editOrder(string &$route = '', array &$args = [], mixed &$output = null): void {
		require_once DIR_EXTENSION . 'hontrio/system/library/core.php';

		$core = new \HontrioCore($this->registry);
		$core->saveOrderSource(isset($args[0]) && is_numeric($args[0]) ? (int)$args[0] : 0, true);
	}
}
