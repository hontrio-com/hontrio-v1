<?php
// =============================================
// Hontrio — evenimentele vitrinei (OpenCart 3.0.x):
// - înaintea antetului: o vizită cu UTM / gclid își pune sursa în sesiune;
// - după addOrder / editOrder: sursa din sesiune se salvează pe comandă.
// Parametrii au valori implicite: chemată direct dintr-o adresă, metoda nu face nimic rău.
// =============================================
class ControllerExtensionHontrioEvent extends Controller {
	public function header(&$route = '', &$args = array()) {
		require_once DIR_SYSTEM . 'library/hontrio/core.php';

		$core = new HontrioCore($this->registry);
		$core->captureSource();
	}

	public function addOrder(&$route = '', &$args = array(), &$output = 0) {
		require_once DIR_SYSTEM . 'library/hontrio/core.php';

		$core = new HontrioCore($this->registry);
		$core->saveOrderSource((int)$output, false);
	}

	public function editOrder(&$route = '', &$args = array(), &$output = null) {
		require_once DIR_SYSTEM . 'library/hontrio/core.php';

		$core = new HontrioCore($this->registry);
		$core->saveOrderSource(isset($args[0]) ? (int)$args[0] : 0, true);
	}
}
