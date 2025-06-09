//
// --------------------------------------------------------------------------

var debugflag = 0;
//var debugflag = 2;

// global variables
// --------------------------------------------------------------------------
var txt_logging;        ///  reference to text logging window
var svc_logging;        ///  reference to Service Commands text logging window
var spn_eta_nodeid;     ///  reference to ETA node-ID spinbox
var spn_eta_nodeid_2;   ///  reference to 2nd ETA node-ID spinbox
var spn_eta_nodeid_svc; ///  referebce ETA nodeid in Service interface tab
var spn_et_nodeid;      ///  reference to ET node-ID spinbox
var spn_et_nodeid_svc;  ///  reference to ET node-ID spinbox on Service Interface Tab
var	ted_SvcPassword;    /// reference to the password field
var tblETdata; 			/// reference to ET data table
var tblETAdata; 		/// reference to ETA data table
var wgtTabWidget; 		/// tabWidget
var auto_logging;
var btnAutoDisable;
var btnAutoEnable;
var lblAutoEnable;
var tblAutoState;

var flagAutomatic = 0;
var flagMessageReceived = 0;

//var fileHandle = new TextFile("logging.txt");

// call commands outside of button events
var globalCommands = [ "util.print(\"Test\")" ];

var svcTimerId = -1;

var isConnected = false;
var ETA_HighestNodeId = 0; // to be set from script
//idx == NodeId
var batStates = [-1,-1,0,0,0,0,0,0,0,0,0,0,0,0];
var ebStates  = [-1,-1,0,0,0,0,0,0,0,0,0,0,0,0];
var o6002     = [-1,-1,0,0,0,0,0,0,0,0,0,0,0,0];
var ETA_attach = [-1,-1,0,0,0,0,0,0,0,0,0,0,0,0];

var ebstate_s = [
	"Disconnected",
	"Connected",
	"Comp. Check",
	"Limiting",
	"Operating",
	"Masterless",
	"sleep",
	"reserved"];

var batstate_s = [
	"VD FSA not active",
	"Do-Not-Attach",
	"Ready-to-Attach",
	"Normal Operation",
	"Please Detach",
	"reserved",
	"Error"];

// Tube state
var tubestate_s = {
	0:"Default",
	1:"Error",
	2:"Not Attached",
	0x04:"AUTO IDLE",
	0x08:"AUTO CHARGE",
	0x10:"AUTO DISCHARGE",
	0x20:"CHARGE FIXED",
	0x40:"DISCHARGE FIXED",
	0x80:"Ext. Power Supply"
}

var lastEmcy = [];
var lastSvcCmd = "";

//logwindow color
const RED = "<font color='red'>"
const RED_E = "</font>" 
const BLACK = "<font color='black'>"
const BLACK_E = "</font>" 
const BLUE = "<font color='blue'>"
const BLUE_E = "</font>" 
const GREEN = "<font color='green'>"
const GREEN_E = "</font>" 


//
// global config variables
// --------------------------------------------------------------------------
const lss_timeout_ms = 50;
const maxETA = 12;
const maxET = 10;
const maxLines = 1500;

const sdoTimeoutVal = 100;


for (var i = 2; i <= maxETA + 1; i++) {
	lastEmcy[i] = [];
    for (var e = 1; e <= maxET + 1; e++) {
    	lastEmcy[i][e]=0;
    }
}
//lastEmcy[maxETA+1][maxET+1]=-1;


// --------------------------------------------------------------------------
var o1018_1 = [];
var o1018_2 = [];
var o1018_3 = [];
var o1018_4 = [];

for (var n = 1; n < maxETA +1; n++) {
	o1018_1[n] = 0;
	o1018_2[n] = 0;
	o1018_3[n] = 0;
	o1018_4[n] = 0;
}

// --------------------------------------------------------------------------
// reset all callbacks
stopCallbacks();
// increase Timerid, to avoid id == 0
util.after(1, "util.print(\"after called\");");
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------


// --------------------------------------------------------------------------
// new CDE know ByteArray() class
// --------------------------------------------------------------------------
try {
	ByteArray.prototype.toString = function() { 
		var i = 0;
		var s ="";
		while ( (i < this.length) && (this[i] != 0) && (this[i] <= 127) ) {
			if ((this[i] >= 32) && (this[i] <= 127)) {
				s = s + String.fromCharCode(this[i]);
			} else {
				s = s + "#"+this[i];
			}
			i++;
		}
		return(s);
	}
} catch(e) {
}

//
// functions
// --------------------------------------------------------------------------
function hex(value) 
{
	if (value == undefined) {
	    return value;
	}
	if (value[0] >= 'A' && value[0] <= 'Z') {
		return value;
	}
	if (value < 0) {
		return value;
	}
	return "0x" + value.toString(16); 
}

// --------------------------------------------------------------------------
function fBLACK(value) 
{
	return BLACK + value + BLACK_E;
}

function fRED(value) 
{
	return RED + value + RED_E;
}

function fBLUE(value) 
{
	return BLUE + value + BLUE_E;
}

function fGREEN(value) 
{
	return GREEN + value + GREEN_E;
}

// --------------------------------------------------------------------------
function setMaxEta(nodeid)
{
    ETA_HighestNodeId = nodeid;
	txt_logging.append(fBLACK("set max ETA nodeid to "+nodeid +"\n"));
}

// --------------------------------------------------------------------------
function sdoTimeout(basevalue, et)
{
var timeout = basevalue;

	if (et > 0) {
		timeout = timeout + (1000 + (et * 250));
	}

	try {
		sdo.setTimeout( timeout );
	} catch(e) {
	}
}

 
// --------------------------------------------------------------------------
function pause(time_ms)
{
	if (canconnection.isConnected() === false) { 
		util.msleep(time_ms);
	} else {
		//can.wait(0xFFF, time_ms); //workaround for msleep
		util.msleep(time_ms);
	}
}


// --------------------------------------------------------------------------
// helper function
// Date
function dateTime()
{
var currentDateTime = new Date();
var hours = currentDateTime.getHours();
var minutes = currentDateTime.getMinutes();
var seconds = currentDateTime.getSeconds();
var milli_seconds = currentDateTime.getMilliseconds();
var day = currentDateTime.getDate();
var month = currentDateTime.getMonth() + 1;
var year = currentDateTime.getFullYear();

var out = "";

	//date
	if (day < 10) {day = "0" + day;}      
	if (month < 10) {month = "0" + month;}
	out = out + "<b>" +"  @ "  + day + "." + month + "." + year + "</b>";

      // add time 
	if (milli_seconds < 10) {milli_seconds = "00" + milli_seconds;} 
      else if (milli_seconds < 100) {milli_seconds = "0" + milli_seconds;} 
	if (seconds < 10) {seconds = "0" + seconds;}
	if (minutes < 10) {minutes = "0" + minutes;}
	if (hours < 10) {hours = "0" + hours;}  

	out = out + " " + "<b>" + hours + ":" + minutes+ ":" + seconds + ","+ milli_seconds+  " " + "</b>";

	return out;       
}

function dateTime_plain()
{
var currentDateTime = new Date();
var hours = currentDateTime.getHours();
var minutes = currentDateTime.getMinutes();
var seconds = currentDateTime.getSeconds();
var milli_seconds = currentDateTime.getMilliseconds();
var day = currentDateTime.getDate();
var month = currentDateTime.getMonth() + 1;
var year = currentDateTime.getFullYear();

var out = "";

	//date
	if (day < 10) {day = "0" + day;}      
	if (month < 10) {month = "0" + month;}
	out = out + day + "." + month + "." + year;

      // add time 
	if (milli_seconds < 10) {milli_seconds = "00" + milli_seconds;} 
      else if (milli_seconds < 100) {milli_seconds = "0" + milli_seconds;} 
	if (seconds < 10) {seconds = "0" + seconds;}
	if (minutes < 10) {minutes = "0" + minutes;}
	if (hours < 10) {hours = "0" + hours;}  

	out = out + " " + hours + ":" + minutes+ ":" + seconds + "."+ milli_seconds;

	return out;       
}


function dateTime_short()
{
var currentDateTime = new Date();
var hours = currentDateTime.getHours();
var minutes = currentDateTime.getMinutes();
var seconds = currentDateTime.getSeconds();
var milli_seconds = currentDateTime.getMilliseconds();
var day = currentDateTime.getDate();
var month = currentDateTime.getMonth() + 1;
var year = currentDateTime.getFullYear();

var out = "";

	//date
	if (day < 10) {day = "0" + day;}      
	if (month < 10) {month = "0" + month;}
	out = out + year + "_" + month + "_" + day;

      // add time 
	if (milli_seconds < 10) {milli_seconds = "00" + milli_seconds;} 
      else if (milli_seconds < 100) {milli_seconds = "0" + milli_seconds;} 
	if (seconds < 10) {seconds = "0" + seconds;}
	if (minutes < 10) {minutes = "0" + minutes;}
	if (hours < 10) {hours = "0" + hours;}  

	out = out + "_" + hours + "_" + minutes+ "_" + seconds;

	return out;       
}


// --------------------------------------------------------------------------
function txtlog(s) {
        txt_logging.append(dateTime());
        txt_logging.append(s);
}
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function isUnknownDevice(nodeId) {
	if (
		(o1018_1[n] == 0)
		&& (o1018_2[n] == 0)
		&& (o1018_3[n] == 0)
		&& (o1018_4[n] == 0))
	{
		return true;
	}
	return false;
}

// --------------------------------------------------------------------------
// lssCheckUnconfigured
// retval - true - an unconfigured device found
function lssCheckUnconfigured() {
var ret;

	can.sendBaseFrame(0x7E5, 8, 0x4C, 0, 0, 0, 0, 0, 0, 0);
	ret = can.wait(0x7E4, lss_timeout_ms);
	return ret;
}

function lssSetKnownNodeid(nodeId) {

	if (isUnknownDevice(nodeId) == true) {
		return false;
	}
	if (lssCheckUnconfigured() == false) {
		return false;
	}
	// check for unused nodeid
	if (hbETA[nodeId] != 0) {
		txt_logging.append(fRED("Error: lssSetKnowNodeid() called for active nodeid\n"));
		return false;
	}

	// reset state on error case
	lss.switchModeGlobal( false );
	pause(lss_timeout_ms);
	
	if (lss.switchModeSelective(o1018_1[nodeId], o1018_2[nodeId], 
								o1018_3[nodeId], o1018_4[nodeId]) == true) {
		pause(lss_timeout_ms);
		lss.configureNodeId( nodeId );
		pause(lss_timeout_ms);
		lss.switchModeGlobal( false );
		pause(lss_timeout_ms);
txt_logging.append("Node "+nodeId+" configured by lssSetKnownNodeid()\n");

		return true;
	}
	return false;
}

function lssSetAllKnownNodeids() {
	for (var nodeId = 1; nodeId < maxETA +1; nodeId++) {
		if (hbETA[nodeId] == 0) {
			lssSetKnownNodeid(nodeId);
		}
	}
}

// --------------------------------------------------------------------------
function setGlobalInstance(nodeId) {
	// assign incrementing global instance offset
	var global_instance_offset = nodeId - 2; //nodeid 2 => offset 0 => GIN 1 + 0 = 1

	sdoTimeout(sdoTimeoutVal);
	sdo.write(0, nodeId, 0x6000, 1, UNSIGNED32, 0x01000106 | (global_instance_offset << 16));
}

function setAllGIN() {
	for (var nodeId = 1; nodeId < maxETA +1; nodeId++) {
		if (hbETA[nodeId] != 0) {
			setGlobalInstance(nodeId);
		}
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// connect to CAN
// --------------------------------------------------------------------------
function handleConnect() {
    canconnection.connect();
    if (canconnection.isConnected() === true) {
        isConnected = true;
        txt_logging.append(fRED("Connected to CAN. <br />"));
        registerCanCallbacks();
    } else {
        isConnected = false;
    }
}


// --------------------------------------------------------------------------
// disconnect from CAN
// --------------------------------------------------------------------------
function handleDisconnect() {
    canconnection.disconnect();
    if (canconnection.isConnected() === false) {
        isConnected = false;
        txt_logging.append(fRED("Disconnected from CAN.<br />"));
    } else {
        isConnected = true;
    }
}


// --------------------------------------------------------------------------
// show CAN configuration dialog
// --------------------------------------------------------------------------
function handleCANConfiguration() {
    if (canconnection.isConnected() === true) {
        txt_logging.append(fRED("Configuration of CAN parameters not possible.<br />"));
    } else {
        canconnection.configureDialog();
    }
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function handleStartSync() {
    // configure SYNC
    util.configureSync(0x80, 100*1000, 0);

    // start Sync
    util.startSync()
	txt_logging.append(fRED("Sync enabled (100ms). <br />"));
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function handleStopSync() {
    // stop Sync
    util.stopSync()
	txt_logging.append(fRED("Sync disabled. <br />"));
}

// --------------------------------------------------------------------------
function handlePreOpAll() {
	globalCommands.push("nmt.preopNetwork()");
}
// --------------------------------------------------------------------------
function handleResetCommAll() {
	globalCommands.push("nmt.resetCommNetwork()");
}
// --------------------------------------------------------------------------
function handleResetApplAll() {
	globalCommands.push("nmt.resetApplNetwork()");
}
// --------------------------------------------------------------------------


// --------------------------------------------------------------------------
// content of logging window into text file
// --------------------------------------------------------------------------
function saveLoggingInText() {
    text = util.getTextEditText("txtLogging");

    // find save file dialog
    fileName = filedialog.getSaveFileName("Select save file"," ","Text (*.txt)");

    f = new TextFile(fileName);
    f.open( 2 | 8 ) // write and truncate
    f.appendString( text );
    f.flush();
    f.close();
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function setTable(table,row,col0,col1,col2,col3) {
		util.setTableItemValue(table,row,0, col0);
		util.setTableItemValue(table,row,1, col1);
		util.setTableItemValue(table,row,2, col2);
		util.setTableItemValue(table,row,3, col3);
}

function readNetwork(etaNodeId) 
{
	var value;
	var networkId;

	sdoTimeout(sdoTimeoutVal);
	value = sdo.read(0, etaNodeId, 0x1F2C,1,UNSIGNED32);
	value = value / 0x10000;
	networkId = value; 

	return networkId;
}

// --------------------------------------------------------------------------
//sdo error returns 0
function sdoReadandCheck(network, nodeid, index, subindex, typ) {
var ret;
var value;
	
	ret = sdo.read(network, nodeid, index, subindex, typ);
	value = parseInt(ret); //check SDO_ERROR
	if (value == NaN) {
		return 0;
	}
	return value;
}

function read1018(nodeid) {
	o1018_1[nodeid] = sdoReadandCheck(0, nodeid, 0x1018, 1, UNSIGNED32);
	o1018_2[nodeid] = sdoReadandCheck(0, nodeid, 0x1018, 2, UNSIGNED32);
	o1018_3[nodeid] = sdoReadandCheck(0, nodeid, 0x1018, 3, UNSIGNED32);
	o1018_4[nodeid] = sdoReadandCheck(0, nodeid, 0x1018, 4, UNSIGNED32);

	if (isUnknownDevice(nodeid) == true) {
		return;
	}
 
	//remove double entrys
	for (var n = 1; n < maxETA +1; n++) {
		if (n != nodeid) {
			if ((o1018_1[nodeid] == o1018_1[n])
				&& (o1018_2[nodeid] == o1018_2[n])
				&& (o1018_3[nodeid] == o1018_3[n])
				&& (o1018_4[nodeid] == o1018_4[n])) 
			{
				o1018_1[n] = 0;
				o1018_2[n] = 0;
				o1018_3[n] = 0;
				o1018_4[n] = 0;
txt_logging.append("read1018 " + nodeid + " moved/remove: " + n);
			}
		}
	}
}

function read1018All() {
	for (var nodeId = 1; nodeId < maxETA +1; nodeId++) {
		if (hbETA[nodeId] != 0) {
			read1018(nodeId); 
		}
	}
}

// --------------------------------------------------------------------------
// read data from selected ET
// --------------------------------------------------------------------------
function readDatafromET() {

    // get node id from ETA spinbox
    var etaNodeId = spn_eta_nodeid_2.value;
    var networkId = 0;
    var etNodeId = spn_et_nodeid.value;

	// configure routing
	sdo.setLocalRouter(etaNodeId);

	sdoTimeout(sdoTimeoutVal);
    value = sdo.read(0, etaNodeId, 0x2010,0,UNSIGNED8);
	if ((value > 0) && ((value + 1) >= etNodeId)) {

		//the node id of the ETA is the network-ID of the net behind

		// variable network number
		networkId = readNetwork(etaNodeId);

		sdoTimeout(sdoTimeoutVal, etNodeId);
		var l = 0;
		tblETdata.clearContents();
		// read values by SDO and add them to tablewidet 'tblETdata'
		value = sdo.read(networkId, etNodeId, 0x1018,1,UNSIGNED32);
		setTable("tblETdata",l,"0x1018:1","Vendor", hex(value),"");

		l++;
		value = sdo.read(networkId, etNodeId, 0x1018,2,UNSIGNED32);
		setTable("tblETdata",l,"0x1018:2","Product",hex(value),"");

		l++;
		value = sdo.read(networkId, etNodeId, 0x1018,3,UNSIGNED32);
		setTable("tblETdata",l,"0x1018:3","Revision",hex(value),"");

		l++;
		value = sdo.read(networkId, etNodeId, 0x1018,4,UNSIGNED32);
		setTable("tblETdata",l,"0x1018:4","Serial",hex(value),"");

		// add information into logging
		txt_logging.append("<tt> ET " + etNodeId +  " serial: " + value + "</tt>");

		l++;
		l++;
		value = sdo.read(networkId, etNodeId, 0x6002,1,UNSIGNED16);
		setTable("tblETdata",l,"0x6002:1","State",hex(value), text_6002(value));
		txt_logging.append("ET " + etNodeId +  text_6002(value));

		l++;
		value = sdo.read(networkId, etNodeId, 0x2001,0,UNSIGNED8);
		setTable("tblETdata",l,"0x2001:0","Tube State",value, text_2001(value));


		// add information into logging
		// more might be logged as well
		txt_logging.append("ET " + etNodeId +  " Tubestate: " + hex(value));

		l++;
		value = sdo.read(networkId, etNodeId, 0x603e,1,INTEGER32);
		setTable("tblETdata",l,"0x603e:1","act. current",value,value + "mA");

		l++;
		value = sdo.read(networkId, etNodeId, 0x6040,1,INTEGER32);
		value2 = sdo.read(networkId, etNodeId, 0x6039,1,INTEGER32);
		setTable("tblETdata",l,"0x6039:1 | 0x6040:1","ext. voltage | act. voltage",value2 + "|" + value, value2/1000.0 + "V | " + value/1000.0 + "V");

		l++;
		value = sdo.read(networkId, etNodeId, 0x6042,1,INTEGER16);
		value2 = sdo.read(networkId, etNodeId, 0x6105,1,INTEGER16);
		setTable("tblETdata",l,"0x6042:1 | 0x6105:1","act. elect. temp | pack temp.",value + " | " + value2, value/10.0 + "C" + " | " + value2/10.0 + "C" );
//		util.setTableItemValue("tblETdata",l,3,value/10.0 + "C");

		l++;
		value = sdo.read(networkId, etNodeId, 0x6164,1,UNSIGNED16);
		value2 = sdo.read(networkId, etNodeId, 0x6176,1,UNSIGNED16);
		setTable("tblETdata",l,"0x6164:1 | 0x6176:1","SOC | SOH",value + " | " + value2 , value/100.0 + "%" + " | " + value2/100.0 + "%" );
//		util.setTableItemValue("tblETdata",l,3,value/100.0 + "%");

		//l++;
		//value = sdo.read(networkId, etNodeId, 0x6176,1,UNSIGNED16);
		//setTable("tblETdata",l,"0x6176:1","SOH",value, value/100.0 + "%" );
//		util.setTableItemValue("tblETdata",l,3,value/100.0 + "%");

		l++;
		//value = sdo.read(networkId, etNodeId, 0x6105,1,INTEGER16);
		//setTable("tblETdata",l,"0x6105:1","Bat. Pack temp",value, value/10.0 + "C" );
//		util.setTableItemValue("tblETdata",l,3,value/10.0 + "C");
		
		//l++;
		l++;
		value = sdo.read(networkId, etNodeId, 0x1F56,1,UNSIGNED32);
		setTable("tblETdata",l,"0x1F56:2","SW ID inactive", hex(value), "");
		l++;
		value = sdo.read(networkId, etNodeId, 0x1F56,2,UNSIGNED32);
		setTable("tblETdata",l,"0x1F56:2","SW ID active", hex(value), "");

		// dummy, deactivate routing internal
		sdo.read(0, etaNodeId, 0x1000, 0, UNSIGNED32);
	} else {
    	txt_logging.append("wrong ET Nodeid\n");
	}

}

// --------------------------------------------------------------------------
function decodeCSDP(csdp) {
	var data0 = csdp & 0xFF;
	var data1 = (csdp >> 8) & 0xFF;
	var data2 = (csdp >> 16) & 0xFF;
	var data3 = (csdp >> 24) & 0xFF;

	var ntop = data2 & 0xF;
	var normOpFlag = (data3 >> 7) & 1;
	var ccFlag = (data3 >> 6) & 1;
	var etaFlag = (data3 >> 5) & 1;
	var fwUpdateFlag = (data3 >> 4) & 1; 

	var s = "CSDP nTop:" + ntop + " normOpF:" + normOpFlag + " CCFlag:" + ccFlag + " etaFlag:" + etaFlag + " FwUpdateFlag:" + fwUpdateFlag;

    txt_logging.append("csdp " + hex(csdp));
    txt_logging.append("normopFlag " + hex(normOpFlag));
    txt_logging.append("ccFlag " + hex(ccFlag));
	txt_logging.append("fwUpdateFlag " + hex(fwUpdateFlag));
	
	return s;
}

// --------------------------------------------------------------------------
// read data from selected ETA
// --------------------------------------------------------------------------
function readDatafromETA() {

    // get node id from ETA spinbox
    var nodeId = spn_eta_nodeid.value;
    sdo.setNodeId(nodeId);
	sdoTimeout(sdoTimeoutVal);

	var l = 0;
    tblETAdata.clearContents();

	// dummy, deactivate routing internal
	sdo.read(0, nodeId, 0x1000,0,UNSIGNED32);


    // read values by SDO and add them to tablewidet 'tblETAdata'
    value = sdo.read(0, nodeId, 0x1018,1,UNSIGNED32);
    setTable("tblETAdata",l,"0x1018:1", "Vendor", hex(value), "");

	l++;
    value = sdo.read(0, nodeId, 0x1018,2,UNSIGNED32);
    setTable("tblETAdata",l,"0x1018:2", "Product", hex(value), "");

	l++;
    value = sdo.read(0, nodeId, 0x1018,3,UNSIGNED32);
    setTable("tblETAdata",l,"0x1018:3", "Revision", hex(value), "");

	l++;
    value = sdo.read(0, nodeId, 0x1018,4,UNSIGNED32);
    setTable("tblETAdata",l,"0x1018:4", "Serial", hex(value), "");

    // add information into logging
    txt_logging.append("ETA " + nodeId +  " serial: " + value);

	l++;
	l++;
    value = sdo.read(0, nodeId, 0x2010,0,UNSIGNED8);
    setTable("tblETAdata",l,"0x2010:0", "number of ETs", value, "");

	l++;
    value = sdo.read(0, nodeId, 0x2100,0,UNSIGNED32);
    setTable("tblETAdata",l,"0x2100:0", "CSDP", hex(value), decodeCSDP(value));

	l++;
    value = sdo.read(0, nodeId, 0x2007,1,UNSIGNED8);
    value2 = sdo.read(0, nodeId, 0x2007,2,UNSIGNED8);
    setTable("tblETAdata",l,"0x2007:1 | 2", "column off state | ETA low volt. flag", value+" | "+value2, "");

	l++;
	l++;
    value = sdo.read(0, nodeId, 0x6002,1,UNSIGNED16);
    setTable("tblETAdata",l,"0x6002:1", "State", hex(value), text_6002(value));

    // add information into logging
    // more might be logged as well
    txt_logging.append("ETA " + nodeId +  text_6002(value));

	l++;
    value = sdo.read(0, nodeId, 0x6039,1,INTEGER32);
    setTable("tblETAdata",l,"0x6039:1", "act. external voltage", value, value/1000.0 + "V");


	l++;
    value = sdo.read(0, nodeId, 0x603e,1,INTEGER32);
    setTable("tblETAdata",l,"0x603E:1", "act. current", value, value/1000.0 + "A");


	l++;
    value = sdo.read(0, nodeId, 0x6040,1,INTEGER32);
    setTable("tblETAdata",l,"0x6040:1", "act. voltage", value, value/1000.0 + "V");


	l++;
    value = sdo.read(0, nodeId, 0x6042,1,INTEGER16);
    setTable("tblETAdata",l,"0x6042:1", "act. elect. temp", value, value/10.0 + "C" );
	
	l++;
	//SOC from ETA
    value  = sdo.read(0, nodeId, 0x6164,1,UNSIGNED16);
	value2 = sdo.read(0, nodeId, 0x6176,1,UNSIGNED16);
	setTable("tblETAdata",l,"0x6164:1 | 0x6176:1","SOC | SOH",value + " | " + value2 , value/100.0 + "%" + " | " + value2/100.0 + "%" );
	//setTable("tblETAdata",l,"0x6164:1", "SOC", value, value/100.0 + "%");

	l++;
	l++;
	value = sdo.read(0, nodeId, 0x1F56,1,UNSIGNED32);
	setTable("tblETAdata",l,"0x1F56:1","CRC", hex(value), "");
	
	//Firmware update
	l++;
	l++;
	value = sdo.read(0, nodeId, 0x2030,1,UNSIGNED8);
	setTable("tblETAdata",l,"0x2030:1","# ETs with wrong FW", value, "");
	l++;
	value = sdo.read(0, nodeId, 0x2030,2,UNSIGNED8);
	setTable("tblETAdata",l,"0x2030:2","ET number of current update", value, "");
	l++;
	value = sdo.read(0, nodeId, 0x2030,3,UNSIGNED8);
	setTable("tblETAdata",l,"0x2030:3","progress of current update", value + "%", "");
	l++;
	value = sdo.read(0, nodeId, 0x2030,4,UNSIGNED8);
	setTable("tblETAdata",l,"0x2030:4","progress of column update", value + "%", "");
	
}


// --------------------------------------------------------------------------
// remove node id and reset communication
// --------------------------------------------------------------------------
function resetAllETA() {
	//simulate heartbeat of EMSC
	can.sendBaseFrame(0x701, 1, 0x05, 0, 0, 0, 0, 0, 0, 0);

	if (1) {
		lss.switchModeGlobal(true);
		util.msleep(100);
		lss.configureNodeId(255);
		util.msleep(100);
		lss.switchModeGlobal(false);
		util.msleep(100);
		nmt.resetCommNetwork();
		util.msleep(100);
	} else {
		nmt.resetApplNetwork();
	}
    txt_logging.append(fRED("NodeIDs removed from all devices.<br />"));

    // clear HB table
    for (pos = 0; pos < maxETA; pos ++) {
        util.setTableItemValue("tblHBETA",0,pos, "-");
        util.setTableItemValue("tblHBETA",1,pos, "-");
        util.setTableItemValue("tblHBETA",2,pos, "-");
    }

	setMaxEta(0);
}

// --------------------------------------------------------------------------
// send start to network
// --------------------------------------------------------------------------
function startETA() {
	var nodeID;
	var global_instance_offset;
	
	sdoTimeout(sdoTimeoutVal);
	for (nodeId = 2; nodeId <= ETA_HighestNodeId; nodeId++) {
		// assign incrementing global instance offset
		global_instance_offset = nodeId - 2; //nodeid 2 => offset 0 => GIN 1 + 0 = 1
		sdo.write(0, nodeId, 0x6000, 1, UNSIGNED32, 0x01000106 | (global_instance_offset << 16));
	}

   	nmt.startNetwork();
	handleStartSync();
}


// --------------------------------------------------------------------------
// assign node-IDs to ETAs
// --------------------------------------------------------------------------
function handleAssignAll() {
	globalCommands.push("assignNodeIDstoETAs()");
}

function assignNodeIDstoETAs() {
    var nodeId =  2;
    var ret = false;
    var global_instance_offset = 0;
	var nodefound;

	btn_assignNodeIds.setStyleSheet("background: red");
	setMaxEta(0);

    //txt_logging.insertHtml("<font color='black'>ETA node ID assignment started ...<br /></font>");
    txt_logging.append(fBLACK("ETA node ID assignment started ...\n"));
    txt_logging.append(fBLACK("(SDO_ERROR: 0x5040000 means Timeout/no device with this nodeid - correct behavior)\n"));

	//wait for all running HB 
	pause(400);
	read1018All(); //read running devices and correct the known list
txt_logging.append(fBLUE("hbETA (0..inactive, start with nodeid 0) "+hbETA));
	// at the first all known devices to prevend a nodeid switch
	lssSetAllKnownNodeids();
	pause(400);

	sdoTimeout(sdoTimeoutVal);
    do {
		nodefound = false;
		if (hbETA[nodeId] != 0) {
			txt_logging.append(fGREEN("working Node Id "+ nodeId + ".\n"));
			nodefound = true;
		} else {

        	txt_logging.append(fGREEN("Looking for Node Id "+ nodeId + " .. .\n"));
        	// check if node id is already in use
        	value = sdo.write(0, nodeId, 0x1017, 0, UNSIGNED16, 100);
			txt_logging.append("Node Id check returned "+ value + "\n");
			if (value === "SDO_OK") {
				txt_logging.append(fRED("Node Id "+ nodeId + " already in use. Process stopped.\n"));
				ret = true; //check next nodeid
				nodefound = true;
			}
			if (value === "SDO_ERROR") {
				txt_logging.append(fRED("Internal SDO error.\n"));
				pause(1000);
				return;
			}
		}

		if (nodefound == false) {
			txt_logging.append("start scan\n");
			// assign node id
			ret = lss.doFastScanAndSetNodeId(lss_timeout_ms, nodeId);
        	if (ret === true) {
            	txt_logging.append(fBLACK("NodeID " + nodeId + " assigned to ETA.\n"));
				nodefound = true;
			}
        }
 
		if (nodefound == true) {
			//util.msleep(300);
			read1018(nodeId);
		}
		if (nodefound == false) {
            txt_logging.append("<font color='black'>Scan end\n</font>");
		}
		nodeId = nodeId + 1;
    } while ((nodefound == true) && (nodeId <= maxETA + 1));

	pause(300);
	setAllGIN();

	txt_logging.append(fBLACK("ETA node ID assignment end."));

        // for some reason we need the sleep
        //util.msleep(1000);
//        setMaxEta(nodeId - 1);

    //send current time
    util.sendTime();
	txt_logging.append(fBLACK("-----------------------------------------"));
	btn_assignNodeIds.setStyleSheet("");
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function resetAttachCommand() {
	for (nodeId = 2; nodeId <= maxETA+1 ; nodeId++) {
		ETA_attach[nodeId] = 0;
	}
	btn_attachAllEta.text = "Attach all ETAs - stopped";
	btn_attachAllEta.setStyleSheet("");
}

function attachAllETA() {
	var nodeId;

	for (nodeId = 2; nodeId <= ETA_HighestNodeId; nodeId++) {
		ETA_attach[nodeId] = 1;
		o6002[nodeId] = 0xffff; //show next PDO
	}
	txt_logging.append(fBLUE("Want to attach ETA 2.."+ ETA_HighestNodeId +". Wait for PDOs.<br />"));
	btn_attachAllEta.text = "Attach all ETAs - active";
	btn_attachAllEta.setStyleSheet("background: red");
	util.after(60000, "resetAttachCommand();"); //max time
}


// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function resetEtaAttach(nodeId) {
	ETA_attach[nodeId] = 0;
	txt_logging.append(fBLUE("Stop commanding ETA "+nodeId+".<br />"));
}

// --------------------------------------------------------------------------
function EtaAttach() {

    // get node id from ETA spinbox
    var nodeId = spn_eta_nodeid.value;

	ETA_attach[nodeId] = 1;
	o6002[nodeId] = 0xffff; //show next PDO
	txt_logging.append(fBLUE("Want to attach ETA "+nodeId+". Wait for PDOs.<br />"));
	util.after(60000, "resetEtaAttach("+nodeId+");"); //max time
 
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------

function EtaDetachNode(nodeId) {
	ETA_attach[nodeId] = 0;
	o6002[nodeId] = 0xffff; //show next PDO
	txt_logging.append(fBLUE("Want to detach ETA. <br />"));

	txt_logging.append(fRED("command 'Detach' Node: " + nodeId + ". <br />"));
	sdoTimeout(sdoTimeoutVal);
    sdo.write(0, nodeId, 0x6001, 1, UNSIGNED16, 3 << 8);
}

function EtaDetach() {
    // get node id from ETA spinbox
    var nodeId = spn_eta_nodeid.value;
	globalCommands.push("EtaDetachNode("+nodeId+")");
}

function EtaDetachAll() {
	for (nodeId = 2; nodeId <= ETA_HighestNodeId; nodeId++) {
		globalCommands.push("EtaDetachNode("+nodeId+")");
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcReadData(nodeId,dataReadyValue) {
	var subIndex = 0;
	//var nodeId = spn_eta_nodeid_svc.value;
	if (debugflag == nodeId) util.print("SVC from ETA "+ nodeId);
	switch (dataReadyValue) {
		case 0x0001:
			subIndex = 0x01
			logText = "ETA SVC"
			break;		
		case 0x0002:
			subIndex = 0x80
			logText = "ET Node 2"
			break;
		case 0x0004:
			subIndex = (0x80 + 1)
			logText = "ET Node 3"
			break;
		case 0x0008:
			subIndex = (0x80 + 2)
			logText = "ET Node 4"
			break;
		case 0x0010:
			subIndex = (0x80 + 3)
			logText = "ET Node 5"
			break;
		case 0x0020:
			subIndex = (0x80 + 4)
			logText = "ET Node 6"
			break;
		case 0x0040:
			subIndex = (0x80 + 5)
			logText = "ET Node 7"
			break;
		case 0x0080:
			subIndex = (0x80 + 6)
			logText = "ET Node 8"
			break;
		case 0x0100:
			subIndex = (0x80 + 7)
			logText = "ET Node 9"
			break;	
		case 0x0200:
			subIndex = (0x80 + 8)
			logText = "ET Node 10"
			break;	
		case 0x0400:
			subIndex = (0x80 + 9)
			logText = "ET Node 11"
			break;	
	}
	
    if (subIndex == 0) {
		if ((dataReadyValue & 0x0001) != 0) svcReadData(nodeId, 0x0001);
		if ((dataReadyValue & 0x0002) != 0) svcReadData(nodeId, 0x0002);
		if ((dataReadyValue & 0x0004) != 0) svcReadData(nodeId, 0x0004);
		if ((dataReadyValue & 0x0008) != 0) svcReadData(nodeId, 0x0008);
		if ((dataReadyValue & 0x0010) != 0) svcReadData(nodeId, 0x0010);
		if ((dataReadyValue & 0x0020) != 0) svcReadData(nodeId, 0x0020);
		if ((dataReadyValue & 0x0040) != 0) svcReadData(nodeId, 0x0040);
		if ((dataReadyValue & 0x0080) != 0) svcReadData(nodeId, 0x0080);
		if ((dataReadyValue & 0x0100) != 0) svcReadData(nodeId, 0x0100);
		if ((dataReadyValue & 0x0200) != 0) svcReadData(nodeId, 0x0200);
		if ((dataReadyValue & 0x0400) != 0) svcReadData(nodeId, 0x0400);
		if ((dataReadyValue & 0xF800) != 0) {
			//error case, bits not used
			svc_logging.append(fRED("Error 0x3201: value "+hex(dataReadyValue) + "\n")); 
		}
	} else {
		sdoTimeout(sdoTimeoutVal);
		dataValue = sdo.read(0, nodeId, 0x3202, subIndex, 0x09);
		
		if (lastSvcCmd == 'V|RE BC ALL') {
			input = dataValue.toString();		    
			startidx = 3;
			output = "";
			count = 0;
			while(count < 16) {
				value = input.substring(startidx,startidx+4);
				output = output + value + "mV ";
				count++;
				startidx = startidx + 4;
			}
			lastSvcCmd = "";	
			svc_logging.append(output);
            return			
		} 
		
		logText = "ETA " + nodeId + " / " + logText;
		svc_logging.append(fBLUE(logText + ": ") + dataValue.toString() + "\n" );
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcCheckDataReady() {
	var nodeId = spn_eta_nodeid_svc.value;
	
	//util.print("SVC check from ETA "+ nodeId);
	sdoTimeout(50);
	value = sdo.read(0, nodeId, 0x3201, 0, UNSIGNED16);
	if (value > 0)
	{	

		if (svcTimerId >= 0) {
			util.deleteTimer(svcTimerId);
			svcTimerId = -1;
		}

		if (debugflag == nodeId) util.print("ETA "+nodeId+" SVC Value available " + value);
		
		svcReadData(nodeId, value);

		if (svcTimerId < 0) {
        	svcTimerId = util.every(50, "svcCheckDataReady();");
		}
	}
	//else
	//{
	//	util.print("NO Value available ")
	//}
	if (!tab_svc.visible)
	{
		if (svcTimerId >= 0) {
			util.deleteTimer(svcTimerId);
			svcTimerId = -1;
			//util.print("svcTimer disabled");
		}
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcCommand(commandString) {

	lastSvcCmd = commandString;
	if (svcTimerId >= 0) {
		util.deleteTimer(svcTimerId);
		svcTimerId = -1;
		util.msleep(50); //stop zyklisches Lesen für SDO Zugriff
	}

	//svc_logging.insertPlaintext(commandString);
	svc_logging.append(commandString);

	var subIndex;
		if(spn_et_nodeid_svc.value >= 2) {
			subIndex = spn_et_nodeid_svc.value + 128 - 2;
		} 
		else if ((spn_et_nodeid_svc.value == 1))
		{
			subIndex = 1;
		}

	var nodeId = spn_eta_nodeid_svc.value;
    //util.print("SVC comm to ETA "+ nodeId);
    //util.print(sdo.write(0, nodeId, 0x3200, subIndex, 0x09, commandString));
	sdoTimeout(sdoTimeoutVal);
    sdo.write(0, nodeId, 0x3200, subIndex, 0x09, commandString);
    
	if (svcTimerId == -1) {
        svcTimerId = util.every(50, "svcCheckDataReady();");
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcEnable() {
	if(spn_et_nodeid_svc.value >= 2)
	{
		//svcCommand("V|WR PW 01 " + ted_SvcPassword.plainText)
		svcCommand("V|WR PW 01 " + ted_SvcPassword.displayText)
		if (debugflag != 0) {
			util.print("Enable Service Interface for ET " + spn_et_nodeid_svc.value + " on ETA node " + spn_eta_nodeid_svc.value);
		}
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcRebootTube() {
	if(spn_et_nodeid_svc.value >= 2)
	{
		svcCommand("V|RB ET");
	}
	else if (spn_et_nodeid_svc.value == 1)
	{
		svcCommand("V|RB EA");
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcShipModeTube() {
	if(spn_et_nodeid_svc.value >= 2)
	{
		svcCommand("V|SE ET SM")
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcReadAndClearEvents() {
	if(!((spn_et_nodeid_svc.value == 1) && (cbx_EventType.currentIndex == 6)))
	{
		svcCommand("V|RC " + cbx_EventType.currentIndex + " F")
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcDumpMemory(){
	if(cbx_dumpOption.currentText == "PART"){
		svcCommand("V|DM " + cbx_memoryType.currentText + " " + cbx_dumpOption.currentText + "|" 
				+ ted_MemoryDumpAddr.displayText + " " + ted_MemoryDumpLength.displayText);
	}
	else if (cbx_dumpOption.currentText == "FULL"){
				svcCommand("V|DM " + cbx_memoryType.currentText + " " + cbx_dumpOption.currentText);
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcTransitionToNormalState(){
	if(spn_et_nodeid_svc.value >= 2)
	{
		svcCommand("V|CH ET NS")
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcReadDmc(){
	svcCommand("V|RE DMC");
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcReadSerialNumber(){
	svcCommand("V|RE SN");
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcChangePassword(){
	if(spn_et_nodeid_svc.value >= 2)
	{
		svcCommand("V|CH PW " + ted_SvcPassword.displayText);
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcEtaTranstionToInitColumnState(){
	if(spn_et_nodeid_svc.value == 1)
	{
		svcCommand("V|CH EA IC")
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcEtaDisableDsh(){
		svcCommand("V|DI DEV")
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcEtaDisablePsh(){
	if(spn_et_nodeid_svc.value == 1)
	{
		svcCommand("V|DI PRO")
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function svcReadBatteryCellVoltage(){
	if(spn_et_nodeid_svc.value >= 1)
	{
		svcCommand("V|RE BC ALL")
	}
}

// --------------------------------------------------------------------------
function svcClearProfilingEventList(){
	if(spn_et_nodeid_svc.value > 1)
	{
		svcCommand("V|CP")
	}
}

// --------------------------------------------------------------------------
function svcReadApplication()
{
	svcCommand("V|RE AP")
}

// --------------------------------------------------------------------------
function svcWriteApplication()
{
	if(cbx_ApplicationType.currentIndex == 0)
	{
	svcCommand("V|WR AP DEFAULT")
	}
	else if(cbx_ApplicationType.currentIndex == 1)
	{
	svcCommand("V|WR AP ESS")
	}
	else if(cbx_ApplicationType.currentIndex == 2)
	{
	svcCommand("V|WR AP ETTRAK")
	}
}

// --------------------------------------------------------------------------
function svcPerformSocEstimation()
{
	if(spn_et_nodeid_svc.value > 1)
	{
		svcCommand("V|ES SOC")
	}
}

// --------------------------------------------------------------------------
function svcSetDebugEMCYs()
{
	if(cbx_DebugEmcyState.currentIndex == 0)
	{
	svcCommand("V|WR EM OFF")
	}
	else if(cbx_DebugEmcyState.currentIndex == 1)
	{
	svcCommand("V|WR EM ON")
	}
}
// --------------------------------------------------------------------------
function svcWriteDMC(){
	if(spn_et_nodeid_svc.value >= 2)
	{
		svcCommand("V|WR DMC " + ted_SvcDMC.displayText);
	}
}

// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// automatic
var autoDeviceString = [];
var autofileHandle;
var resetState = [];


// --------------------------------------------------------------------------
function autolog(nodeid, s) {
	auto_logging.append(dateTime() + " ," + nodeid + ", " + s);
    if (autofileHandle != undefined) {
		autofileHandle.appendString(dateTime_plain() + " ," + nodeid + ", " +s + "\n");
		autofileHandle.flush();
	}
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
var autoSvcTimeout= 0;
var autoSvcTimeoutId= 0;

function autoStopSvc() {
	autoSvcTimeout = 1;
//util.print("autoStopSvc ");
}

function autoSetSvcTimeout(t) {
var ret;
	if (autoSvcTimeoutId > 0) {
		ret = util.deleteTimer(autoSvcTimeoutId);
//util.print("delete autoSvcTimeoutId " + autoSvcTimeoutId + "returns " + ret);
		autoSvcTimeoutId = -1;
	}
	autoSvcTimeoutId = util.after(t, "autoStopSvc()");
//util.print("autoSvcTimeoutId " + autoSvcTimeoutId );
	autoSvcTimeout = 0;
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
//In case of a ETA reset command and a long SDO timeout time 
//the timing calculation is wrong
function autoSvcCommand(eta, et, command) {
	var subIndex;
	var cnt;
	var value;
	var mask;
	var eventstring;

	if (flagAutomatic == 0) return;
	if (et >= 2) {
		subIndex = 128 + et - 2;
		mask = 1 << (et - 1)
	} else {
		subIndex = 1;
		mask = 1;
	}

	autolog(eta, "ET " + et + " " + command);

	sdoTimeout(sdoTimeoutVal);
	eventstring = sdo.read(0, eta, 0x3202, subIndex, 0x09);//dummy read

    sdo.write(0, eta, 0x3200, subIndex, 0x09, command);

	autoSetSvcTimeout(10000); //10s
	do {
		if (hbETA[eta] == 0) {
			return;
		}
		value = sdo.read(0, eta, 0x3201, 0, UNSIGNED16);
	    if (value == "SDO_ERROR: 0x5040000") {
			autolog(eta, "ET " + et + " access timeout");
			return;
		}
		value = parseInt(value); //check SDO_ERROR
		if ((value != NaN) && ((value & mask) != 0)) {
			eventstring = sdo.read(0, eta, 0x3202, subIndex, 0x09);
			eventstring = eventstring.toString();
			autolog(eta, "ET " + et + " " + eventstring);

			if (eventstring.indexOf("FAIL-No event") > -1) {
				if (debugflag == eta) autolog(eta, "no event");
			    return;
			}
			if (eventstring.indexOf("FAIL-Transition not allowed") > -1) {
				if (debugflag == eta) autolog(eta, "No error transition");
			    return;
			}
			if (eventstring.indexOf(" OK-Transition") > -1) {
				if (debugflag == eta) autolog(eta, "OK transition");
			    return;
			}
			if (eventstring.indexOf("OK-Read and Clear Done") > -1) {
				if (debugflag == eta) autolog(eta, "event end");
			    return;
			}
			if (eventstring.indexOf("OK-INTERFACE ACTIVATED") > -1) {
				if (debugflag == eta) autolog(eta, "password ok");
			    return;
			}
			if (eventstring.indexOf("FAIL-PLEASE ENTER PASSWORD COMMAND") > -1) {
				if (debugflag == eta) autolog(eta, "password again");
				autoWritePassword(eta, et);
				autoSvcCommand(eta, et, command);
				return;
			}
			autoSetSvcTimeout(10000); //10s
		}
		if (!ui.visible) { /*util.print("not visible");*/ return;} //stopp
		if (flagAutomatic == 0) { /*util.print("no auto");*/ return;}
		pause(50);
	} while (autoSvcTimeout == 0);
	//util.print("autoSvcTimeout");
}


// --------------------------------------------------------------------------
function autoWritePassword(eta, et) {
	if (et < 2) return; //no password on eta
	if (debugflag == eta) autolog(eta,"WritePassword " + et);
	util.setTableItemValue("autoStateTable",eta-2, 2, "WritePassword");
	autoSvcCommand(eta, et, "V|WR PW 01 EnergyTube082016");
}

// --------------------------------------------------------------------------
function autoReadEvent(eta, et, eventnr) {
	if ((et == 1) && (eventnr == 6)) return;
	util.setTableItemValue("autoStateTable",eta-2, 2, "ReadEvent");
	if (debugflag == eta) autolog(eta,"ReadEvent " + et + " event " + eventnr);
	autoSvcCommand(eta, et,"V|RC " + eventnr + " F");
}

// --------------------------------------------------------------------------
function autoWriteReset(eta, et) {
	if (debugflag == eta) autolog(eta,"WriteReset " + et);
	util.setTableItemValue("autoStateTable",eta-2, 2, "WriteReset");
	if(et >= 2) {
		autoSvcCommand(eta,et,"V|RB ET");
	} else {
		autoSvcCommand(eta,et,"V|RB EA");
	}
}

// --------------------------------------------------------------------------
function autoWriteInitState(eta, et) {
	util.setTableItemValue("autoStateTable",eta-2, 2, "Write Init");
	if(et >= 2) {
		autolog(eta,"svc NORMAL_STATE ET: " + et);
		//NORMAL_STATE
		autoSvcCommand(eta, et, "V|CH ET NS")
	} else {
		autolog(eta,"svc INIT_COLUMN");
		//INIT_COLUMN
		autoSvcCommand(eta, et,"V|CH EA IC")
	}
}

// --------------------------------------------------------------------------
//
// read all saved events and reset the column
// 
// --------------------------------------------------------------------------
function autoReadAllEvents(nodeid) {
	var et;
	var numET;
	var persError;
	var f;
	var wrongET;

	//stop background traffic - also done before calling
	autoStopTimer();

	sdoTimeout(sdoTimeoutVal);
	numET = sdo.read(0, nodeid, 0x2010,0, UNSIGNED8);
	autolog(nodeid,"Tubes in column - numET = " + numET);
	if (numET == 0) {
		autoStart();
		return; //no working column
	}

	wrongET = sdo.read(0, nodeid, 0x2030, 1, UNSIGNED8);
	if (wrongET > 0) {
		//update running, no reset
		autoDeviceString[nodeid] = "Column in Update state";
		autoStart();
		return;
	}

	if (resetState[o1018_4[nodeid]] == undefined) {
		resetState[o1018_4[nodeid]] = 0;
	}

	lblAutoEnable.text = "Automatic running - access only one device" 
	autolog(nodeid,"");
	autolog(nodeid,"Read events and Reset");
	autolog(nodeid, "reset state "+ resetState[o1018_4[nodeid]]);
	autolog(nodeid, "reset state - 0/1 reset minimal devices using Init Column/Normal State");
	autolog(nodeid, "reset state - 2 reset all using Init Column/Normal State");
	autolog(nodeid, "reset state - 3 reset all using Reboot");
	autolog(nodeid,"");

	//check, if we know error - in this case only reset this one
	if (numET > 0) { 
		f = 0;
		for (et = (numET + 1); et > 0; et--) {
			if (et == 1) {
				persError = sdo.read(0, nodeid, 0x2000, 1, UNSIGNED32);
				autolog(nodeid,"persistent error of ETA =" + hex(persError));
			} else {
				persError = sdo.read(0, nodeid, 0x2000, 0x80 + et - 2, UNSIGNED32);
			}
			if ((lastEmcy[nodeid][et] == 0) && (persError != 0)) {
				lastEmcy[nodeid][1] = -1; //overwrite 0-value in case of error
			}
			if (lastEmcy[nodeid][et] != 0) {
				autolog(nodeid,"last EMCY "+ et + ": " + hex(lastEmcy[nodeid][et]));
				f++;
			}
		}

		//f == 0 no errornous device found, but ETA is in error?
		//reset state 2.. generate internal error for all devices
		if ((f == 0) || (resetState[o1018_4[nodeid]] > 1)) {
			// error node clear, reset all
			autolog(nodeid," -- Error Reset of all devices -- ");
			for (et = (numET + 1); et > 0; et--) {
				lastEmcy[nodeid][et] = -1;
			}
		}

		for (et = (numET + 1); et > 0; et--) {
			if (lastEmcy[nodeid][et] == 0) {
				continue; //quick reset error
			}
			lastEmcy[nodeid][et] = 0;

			if (!ui.visible) return; //stopp

			autolog(nodeid,"read and reset ET "+et);
			autoWritePassword(nodeid, et);
			if (flagAutomatic == 0) return;

			autoReadEvent(nodeid, et, 1);
			if (flagAutomatic == 0) return;

			autoReadEvent(nodeid, et, 4);
			if (flagAutomatic == 0) return;

			autoReadEvent(nodeid, et, 5);
			if (flagAutomatic == 0) return;

			//all
			if (resetState[o1018_4[nodeid]] < 3) {
				autoWriteInitState(nodeid, et); //Versuch 0,1,2
			} else {
				autoWriteReset(nodeid, et);     //Versuch 3
			}
			if (flagAutomatic == 0) return;
		}
	} 
	//restart work
	resetState[o1018_4[nodeid]]++;
	if (flagAutomatic == 0) return;
	autoStart();
}

// --------------------------------------------------------------------------
var etaNode2Serial = [];

// --------------------------------------------------------------------------


// --------------------------------------------------------------------------
function autoReadSerial(nodeid) {
	var serial;
	var oldNode;
	var crc;

	sdoTimeout(sdoTimeoutVal);
	serial = sdo.read(0, nodeid, 0x1018, 4, UNSIGNED32);
	util.setTableItemValue("autoStateTable",nodeid-2, 0, serial);
	if (serial != etaNode2Serial[nodeid]) {
		oldNode = etaNode2Serial.indexOf(serial);
		if (oldNode > 0) {
			autolog(oldNode, "Nodeid changed to "+nodeid);
			etaNode2Serial[oldNode] = -1; // remove old entry
		}

		autolog(nodeid, "ETA Serial: " + serial);
		etaNode2Serial[nodeid] = serial;
	}

	read1018();
	autolog(nodeid, "ETA CRC: " + sdo.read(0, nodeid, 0x1F56, 1, UNSIGNED32));
	autolog(nodeid, "ETA Updatestate (wrong tubes): " + sdo.read(0, nodeid, 0x2030, 1, UNSIGNED8));
}

// --------------------------------------------------------------------------
function autoStartETA(nodeid) {

	var global_instance_offset = nodeid - 2; //nodeid 2 => offset 0 => GIN 1 + 0 = 1

	if (debugflag != 0) autolog(nodeid, "hbETAState "+hbETAState[nodeid]);

	if (hbETAState[nodeid] == 127) {
		sdo.write(0, nodeid, 0x6000, 1, UNSIGNED32, 0x01000106 | (global_instance_offset << 16));
		nmt.startNode(nodeid);
	}

    //send current time
    util.sendTime();
}

// --------------------------------------------------------------------------
function autoCheckLSS(nodeid) {
var n;

	if (debugflag == nodeid) autolog(nodeid, "autoCheckLSS " + nodeid);
	for (n = 2; n < nodeid; n++) {
		if (hbETA[n] == 0) {
//wrong - do LSS for the other Nodeid
			//ignore this lss command
		    if (debugflag == nodeid) autolog(nodeid, "ignore - Node " + n + " don't have a nodeid");
			return;
		}
	}
	lss.doFastScanAndSetNodeId(lss_timeout_ms, nodeid);
	pause(100);
}

// --------------------------------------------------------------------------
var autoState = []; // current state
var autoTimerCnt = []; // counter for current state time

// --------------------------------------------------------------------------
// 1s Timer tick
function autoTimerTick() {
var nodeid;	
	for (nodeid = 2; nodeid <= maxETA + 1; nodeid++) {
		if (autoTimerCnt[nodeid] < 10000) {
			autoTimerCnt[nodeid]++;
		}
	}
}

// --------------------------------------------------------------------------
// central automatic state machine
// --------------------------------------------------------------------------
function autoCycle(nodeid) {

	// overload debugging
	lblAutoEnable.text = "running - commands " + globalCommands.length
	if (globalCommands.length > 50) {
		globalCommands.push("autolog(0, \"Timediff "+ dateTime_plain() + "\")");
	}

	if (debugflag == nodeid) {
		autolog(nodeid, "");
		autolog(nodeid, "autoCycle " + nodeid );
	}

	if (canconnection.isConnected() === false) {
		globalCommands.push("autoDisable();");
	}

	//initial check
	if (autoState[nodeid] == undefined) {
		autoState[nodeid] = 0;
	}
	
	if (debugflag == nodeid) {
		autolog(nodeid, "autoState " +  autoState[nodeid] );
		autolog(nodeid, "hbETA " +  hbETA[nodeid] );
	}

	util.setTableItemValue("autoStateTable",nodeid-2, 1, autoState[nodeid] + " " + autoDeviceString[nodeid]);
	util.setTableItemValue("autoStateTable",nodeid-2, 2, autoTimerCnt[nodeid]);

	
	// check for Nodeid - start scan
	//-------------------------------
	if (autoState[nodeid] == 0) {
		if (debugflag == nodeid) globalCommands.push("autolog(0, \"Timediff "+ dateTime_plain() + "\")");
		autoTimerCnt[nodeid] = 0;
		if (hbETA[nodeid] == 0) {
			var n;
			for (n = 2; n < nodeid; n++) {
				if (hbETA[n] == 0) {
					//at the first the lower nodeids
					//
					autoDeviceString[nodeid] = "no nodeid - wait other";
					autoState[nodeid] = 1; //wait State ..
					return;
				}
			}
			autoDeviceString[nodeid] = "no nodeid - LSS";

			for (n = 1; n <= maxET + 1; n++) {
				lastEmcy[nodeid][n] = 0;
			}
			globalCommands.push("autoCheckLSS("+ nodeid +");");
		}
		autoState[nodeid] = 1;
		return
	} 

	// wait for new nodeid
	//-------------------------------
	if (autoState[nodeid] == 1) {
		autoDeviceString[nodeid] = "wait";
		if (debugflag == nodeid) autolog(nodeid, "autoTimerCnt " +  autoTimerCnt[nodeid] );
		//automatic timer		autoTimerCnt[nodeid]++;
		if (autoTimerCnt[nodeid] > 10) { //10s
			autoState[nodeid] = 2;
		}
		if (hbETA[nodeid] != 0) {
		    	//Bootup/HB received
			autoState[nodeid] = 2;
		}
		return
	}

	//check for nodeid
	if ((autoState[nodeid] >= 2) && (autoState[nodeid] < 999)) {
		autoDeviceString[nodeid] = "";
		if (hbETA[nodeid] == 0) {
			autoState[nodeid] = 999; //start from beginning
			autoDeviceString[nodeid] = "no nodeid";
			//return;
		}
	} 


	// ETA has a nodeid - start device
	if (autoState[nodeid] == 2) {
		o6002[nodeid] = 0; // reset value for PDO check
		globalCommands.push("autoReadSerial("+ nodeid + ");");
		globalCommands.push("autoStartETA(" + nodeid + ")");

		autoDeviceString[nodeid] = "NMT";
		autoTimerCnt[nodeid] = 0;
		autoState[nodeid] = 3;
		return
	} 

	// wait a moment to synchronise
	if (autoState[nodeid] == 3) {
		autoDeviceString[nodeid] = "NMT wait";
		if (debugflag == nodeid)  autolog(nodeid, "autoTimerCnt " +  autoTimerCnt[nodeid] );
		//automatic		autoTimerCnt[nodeid]++;
		if (autoTimerCnt[nodeid] > 30) { //30s
			autoState[nodeid] = 4;
			autoTimerCnt[nodeid] = 0;
		}
		if ((hbETAState[nodeid] == 5) && (o6002[nodeid] != 0)) {
		    	// Operational received, PDO received
			autoState[nodeid] = 4;
			autoTimerCnt[nodeid] = 0;
		    }
		return
	} 


	//check for NMT Operational
	if ((autoState[nodeid] >= 4) && (autoState[nodeid] < 999)) {
		if (debugflag == nodeid)  autolog(nodeid, "hbETAState " +  hbETAState[nodeid] );
		if (hbETAState[nodeid] != 5) {
			autoDeviceString[nodeid] = "no NMT Operational";
			autoState[nodeid] = 999; //start from beginning
		}
	}

	if (autoState[nodeid] == 4) {
		autoDeviceString[nodeid] = "EB " + hex(o6002[nodeid]);

		if (autoTimerCnt[nodeid] == 0) {
			return; //check states only every 1s
		}
		autoTimerCnt[nodeid] = 0;

		if (o6002[nodeid] == 0) {
			autolog(nodeid, "State PDO not received - NMT Reset Comm");
			nmt.resetCommNode(nodeid);
			autoState[nodeid] = 999; //start from beginning
			return;
		}
		if ((o6002[nodeid] & 0xE000) == 0x2000) {
			//ignore
			return;
		}
		if (o6002[nodeid] == 0x4040) {
			//Compatibly check, do not attach
			// ignore
			return;
		}
		if (o6002[nodeid] == 0x4080) {
			//Compatibly check, ready to attach
			autolog(nodeid, "Compatibly check - Ready to Attach");
			//Limiting
			globalCommands.push("sdo.write(0,"+nodeid+",0x6001,1, UNSIGNED16, 0x0005); ");
			return;
		}
		if (o6002[nodeid] == 0x6080) {
			//Limiting, ready to attach
			autolog(nodeid, "Limiting - Ready to Attach");
			//->Operating
			globalCommands.push("sdo.write(0,"+nodeid+",0x6001,1, UNSIGNED16, 0x0004); ");
			return;
		}
		if (o6002[nodeid] == 0x8080) {
			//Operating, ready to attach
			autolog(nodeid, "Operating - Ready to Attach");
			//->Attached
			globalCommands.push("sdo.write(0,"+nodeid+",0x6001,1, UNSIGNED16, 0x04 << 8); ");
			return;
		}
		if (o6002[nodeid] == 0x80C0) {
			//Operating, attached
			autolog(nodeid, "Operating - Attached");
			autoState[nodeid] = 10;
			autoDeviceString[nodeid] = "ready " + hex(o6002[nodeid]);

			if (resetState[o1018_4[nodeid]] > 0) {
				autolog(nodeid, "Info - resetState = 0");
			}
			resetState[o1018_4[nodeid]] = 0;
			return;
		}
		if (o6002[nodeid] == 0x4180) {
		    autoDeviceString[nodeid] = "Error";
			autolog(nodeid, "Error State "+hex(o6002[nodeid]));
			autoState[nodeid] = 5;
		}
	}

	if (autoState[nodeid] == 5) {
		autoDeviceString[nodeid] = "error " + hex(o6002[nodeid]);
		autoStopTimer();
		// error state
		globalCommands.push("autoReadAllEvents("+nodeid+");");
		autoState[nodeid] = 6; //start from beginning
		autoTimerCnt[nodeid] = 0;
		return
	}

	// wait a moment to synchronise
	if (autoState[nodeid] == 6) {
		autoDeviceString[nodeid] = "reset after error ";
		if (debugflag == nodeid)  autolog(nodeid, "autoTimerCnt " +  autoTimerCnt[nodeid] );
		//automatic		autoTimerCnt[nodeid]++;
		if (autoTimerCnt[nodeid] > 20) { //20s
			autoState[nodeid] = 999;
		}
		return
	} 

	//check for Attached
	if ((autoState[nodeid] >= 10) && (autoState[nodeid] < 999)) {
		if (o6002[nodeid] != 0x80C0) {
			autoState[nodeid] = 999; //start from beginning
			autoDeviceString[nodeid] = "wrong/unknown EB state: " + hex(o6002[nodeid]);
		}
	}
 
	if (autoState[nodeid] == 10) {
		autoDeviceString[nodeid] = "ready - EB state: " + hex(o6002[nodeid]);
		return
	}

	//start from beginning
	if (autoState[nodeid] >= 11) {
		autoState[nodeid] = 0;
		if (debugflag == nodeid)  autolog(nodeid, "autoState reset to 0" +  autoState[nodeid] );
	}

}

// --------------------------------------------------------------------------
var autoTimerId = [];
var autoTimerTickId = -1;

// init cyclic timer
function autoInitTimer(nodeid) {
	autoTimerId[nodeid] = util.every(1000,	"if (globalCommands.length < 20) globalCommands.push(\"autoCycle(" + nodeid +")\")");
}

// init automatical system
function autoStart() {
	var nodeid;
	lblAutoEnable.text = "Automatic running" 
	autolog(0, "start cyclic calls for all ETAs" );
	for (nodeid = (maxETA + 1); nodeid >= 2 ; nodeid--) {
		util.after(nodeid * 50,"globalCommands.push(\"autoInitTimer(" + nodeid +")\")");
	}
	autoTimerTickId = util.every(1000, "autoTimerTick()");
}

// enable automatic
function autoEnable() {
	flagAutomatic = 1;
	lblAutoEnable.text = "Automatic running - wait 2s"

	autofileHandle = new TextFile("logging"+dateTime_short()+".txt");
	autofileHandle.open( 2 | 8 ) // write and truncate
	autofileHandle.appendString("Date , ETA Nodeid, Information\n");

	autolog(0, "Automatic started - waiting 2s");

	globalCommands.push("handleStartSync()");
	util.after(2000, "autoStart()");
}

function autoStopTimer() {
	for (nodeid = 2; nodeid <= (maxETA+1) ; nodeid++) {
		if (autoTimerId[nodeid] >= 0 ) {
			util.deleteTimer( autoTimerId[nodeid] );
		}
		autoTimerId[nodeid] = -1;
	}

	if (autoTimerTickId >= 0) {
		util.deleteTimer(autoTimerTickId);
		autoTimerTickId = -1;
	}
	autolog(0, "all automatic timer stopped");
}

function autoDisable() {
	var nodeid;
	flagAutomatic = 0;
	lblAutoEnable.text = "Stopped"
	autolog(0, "Automatic stopped");
	autoStopTimer();
}




// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
//HB 0..inactive, 1..active, 2.. received during the last period
var hbETA = [0,0,0,0,0,0,0,0,0,0,0];
var hbETAState = [0,0,0,0,0,0,0,0,0,0,0];
var hbTimerId = -1;

function hbReceived(nodeid, state) {
		if (hbETA[nodeid] == 0) {
			globalCommands.push("autolog("+nodeid+",\"HBStarted Node" + nodeid +"\")");
			globalCommands.push("txtlog(\"HBStarted Node" + nodeid +"\")");
		}
		hbETA[nodeid] = 2;
		hbETAState[nodeid] = state; 
}

function hbTimerCallback() {
	var nodeid;
	for (nodeid = 2; nodeid <= (maxETA+1) ; nodeid++) {
		if (hbETA[nodeid] == 1) {
			hbETA[nodeid] = 0; //HB Lost
			hbETAState[nodeid] = 0; //HB Lost
			globalCommands.push("autolog("+nodeid+",\"HBLost Node" + nodeid +"\")");
			globalCommands.push("txtlog(\"HBLost Node" + nodeid +"\")");
			util.setTableItemValue("tblHBETA",0,nodeid-2, "--");
			util.setTableItemValue("tblHBETA",1,nodeid-2, "--");
			util.setTableItemValue("tblHBETA",2,nodeid-2, "--");
		}
		if (hbETA[nodeid] == 2) {
			hbETA[nodeid] = 1;
		}
	}
}

function hbStartChecking(t) {
	var nodeid;
	for (nodeid = 2; nodeid <= (maxETA+1); nodeid++) {
		hbETA[nodeid] = 0;
		hbETAState[nodeid] = 0; 
	} 
	hbTimerId = util.every(t, "hbTimerCallback();");
	
}

//how often we should check
// 1000ms works good, but lss access often new nodeids
// the message is send every 100ms
// test standard value of 300ms
hbStartChecking(300);

// --------------------------------------------------------------------------
// handle HB messages EMSC2
// --------------------------------------------------------------------------
var emsc2Cnt = 0;
function emsc2Callback(id, rtr, len, d0, d1, d2, d3, d4, d5, d6, d7) {

	flagMessageReceived = 1;
	if (emsc2Cnt == 0) {
		txt_logging.append("EMSC2 active");
		emsc2Cnt = 100;
	} else {
		emsc2Cnt--;
	}
}

// --------------------------------------------------------------------------
// handle HB messages and write node state into table
// --------------------------------------------------------------------------
function hbCallback(id, rtr, len, d0, d1, d2, d3, d4, d5, d6, d7) {
    var nodeId = id - 0x700;
	flagMessageReceived = 1;

    if (nodeId <= maxETA + 1) {
        util.setTableItemValue("tblHBETA",0,nodeId-2, d0.toString(16));
    }

	if (d0 == 0) {
    	txt_logging.append("Bootup Node " + nodeId);
	}

	if (nodeId > ETA_HighestNodeId ) {
		setMaxEta(nodeId);
	}

	hbReceived(nodeId, d0);
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------

function text_6002 (o6002_l) {
    var ebState  = (o6002_l >> 13) & 0x7;
    var batState = (o6002_l >> 6) & 0x3f;

	var ret = ""
			+ " EBState: " + util.formatString("0x%x", o6002_l) 
			+ " / EB: " + ebstate_s[ebState]
			+ " / Bat: " + batstate_s[batState]
 			+ "";

	return ret;
}

// added by ITK
function text_2001 (o2001_0) {
	return "State: " + tubestate_s[o2001_0];
}

// --------------------------------------------------------------------------
// handle ETA PDOs with state (and limitation)
// --------------------------------------------------------------------------
function pdoMSN1_callback(id, rtr, len, d0, d1, d2, d3, d4, d5,d6,d7) {
    var eta_num  = id - 0x191;  // starts with 1 (BP 1 ...) 0x192-0x191 == Bat 1
    var eta_nodeID = eta_num + 1; // we assume that ETA 1 has node-ID 2 ..

    var o6002_l =  (d1 << 8) + d0;
    var ebState  = (o6002_l >> 13) & 0x7;
    var batState = (o6002_l >> 6) & 0x3f;

	var ret = "unused";
	flagMessageReceived = 1;

    //fileHandle.appendString("Node " + eta_nodeID + ";MSN1;"+hex(o6002_l)+";;"+ebstate_s[ebState]+";;"+batstate_s[batState]+";;\n");
    //fileHandle.flush();

	util.setTableItemValue("tblHBETA",1,eta_nodeID-2, d1.toString(16));
	util.setTableItemValue("tblHBETA",2,eta_nodeID-2, d0.toString(16));

	if (o6002_l != o6002[eta_nodeID]) {
		//txt_logging.insertHtml("<font color='blue'> node: " + eta_nodeID 
		//	+ " State: " + util.formatString("0x%x", o6002_l) 
		//	+ " EB: " + ebstate_s[ebState]
		//	+ " Bat: " + batstate_s[batState]
 		//	+ " <br /></font>");
		txtlog("<font color='blue'> node: " + eta_nodeID 
			+ text_6002(o6002_l)
 			+ "</font>");
		o6002[eta_nodeID] = o6002_l;

		ebStates[eta_nodeID] = ebState;
        batStates[eta_nodeID] = batState;

		globalCommands.push("checkAttached("+eta_nodeID+")");
	
	}
}


// --------------------------------------------------------------------------
// attach ETA
// --------------------------------------------------------------------------
function checkAttached(eta_nodeID)
{
    var o6002_l =  o6002[eta_nodeID];
    var ebState  = (o6002_l >> 13) & 0x7;
    var batState = (o6002_l >> 6) & 0x3f;

	if (debugflag != 0) util.print("checkAttached for "+eta_nodeID+ " " +text_6002(o6002_l));
 

		if (ETA_attach[eta_nodeID] != 0) {
			// check for 'ready to attach'
			if (batState == 2) {
				//txt_logging.insertHtml("<font color='blue'>'Ready to attach' node: " + eta_nodeID + " -> call 'Normal Operation'. <br /></font>");

				//txt_logging.insertPlainText("bat == 2");
				if (ebState == 2) { //Comp Check
					txtlog(fRED("command 'Limiting' Node: " + eta_nodeID + "."));
					ret = sdo.write(0, eta_nodeID, 0x6001,1, UNSIGNED16, 0x0005);
					if (ret === "SDO_ERROR") {
						txtlog("<font color='red'>SDO Error Node: " + eta_nodeID + ".</font>");
					}
					//-> Limiting
				} else
				if (ebState == 3) { //Limiting
					txtlog(fRED("command 'Operating' Node: " + eta_nodeID + "."));
					ret = sdo.write(0, eta_nodeID, 0x6001,1, UNSIGNED16, 0x0004);
					if (ret === "SDO_ERROR") {
						txtlog(fRED("<font color='red'>SDO Error Node: " + eta_nodeID + "."));
					}
					//-> Operating
				}
				if (ebState == 4) { // Operating
					txtlog(fRED("command 'Normal Operation' Node: " + eta_nodeID + ". <br />"));
					ret = sdo.write(0, eta_nodeID, 0x6001,1, UNSIGNED16, 0x04 << 8);
					if (ret === "SDO_ERROR") {
						txtlog(fRED("SDO Error Node: " + eta_nodeID + "."));
					}
					//-> Bat attach
				}
			}

		}	
}




// --------------------------------------------------------------------------
// handle ETA PDOs with current and voltage
// --------------------------------------------------------------------------
function pdoMSN2_callback(id, rtr, len, d0, d1, d2, d3, d4, d5,d6,d7) {
    var eta_num  = id - 0x291;  // starts with 1 (BP 1 ...)
    var eta_nodeID = eta_num + 1; // we assume that ETA 1 has node-ID 2 ..


    // calculate values for voltage and currents
    var current = (d3 * (1 << 24)) + (d2 << 16) + (d1 << 8) + d0;
	// U32 to I32
	current = current << 0;
    var voltage = (d7 * (1 << 24)) + (d6 << 16) + (d5 << 8) + d4;
//    txt_logging.insertHtml("<font color='green'>MSN 2 Node:" + eta_nodeID + " " +  current + " " + voltage   + "<br /></font>");
    //fileHandle.appendString("Node " + eta_nodeID + ";MSN2;"+current+";mA;"+voltage+";mV\n");
    //fileHandle.flush();
	flagMessageReceived = 1;
}

// --------------------------------------------------------------------------
// handle ETA PDOs with capacity and temperature
// --------------------------------------------------------------------------
function pdoMSN3_callback(id, rtr, len, d0, d1, d2, d3, d4, d5,d6,d7) {
    var eta_num  = id - 0x391;  // starts with 1 (BP 1 ...)
    var eta_nodeID = eta_num + 1; // we assume that ETA 1 has node-ID 2 ..

    // calculate values
    var capacity = (d3 * (1 << 24)) + (d2 << 16) + (d1 << 8) + d0;
    var temp = (d5 << 8) + d4;

    //txt_logging.insertHtml("<font color='green'>MSN 3 Node:" + eta_nodeID + " " +  capacity + " " + temp   + "<br /></font>");
    //fileHandle.appendString("Node " + eta_nodeID + ";MSN3;"+capacity+";mWh;"+temp+";??°C\n");
    //fileHandle.flush();
	flagMessageReceived = 1;
}

// --------------------------------------------------------------------------
// handle ETA PDOds - alarm status
// --------------------------------------------------------------------------
function pdod_callback(id, rtr, len, d0, d1, d2, d3, d4, d5,d6,d7) {
    var eta_num  = id - 0x491;  // starts with 1 (BP 1 ...)
    var eta_nodeID = eta_num + 1; // we assume that ETA 1 has node-ID 2 ..

    // calculate values
    var alarm = (d3 * (1 << 24)) + (d2 << 16) + (d1 << 8) + d0;

	if (alarm != 0) {
    	txtlog(fGREEN("Pdo d Node:" + eta_nodeID + " alarm: " +  hex(alarm)));
	}

    //fileHandle.appendString("Node " + eta_nodeID + ";Pdod;"+alarm+";   ;\n");
    //fileHandle.flush();
	flagMessageReceived = 1;
}

// --------------------------------------------------------------------------
// EMCY callback
// --------------------------------------------------------------------------
function emcy_callback(id, rtr, len, d0, d1, d2, d3, d4, d5,d6,d7) {
    var eta_num  = id - 0x81;  // starts with 1 (BP 1 ...)
    var eta_nodeID = eta_num + 1; // we assume that ETA 1 has node-ID 2 ..

    // calculate values
    var error_code = (d1 << 8) + d0;
	var addbytes = hex(d3) +" " + hex(d4) + " " + hex(d5) + " " + hex(d6) + " " + hex(d7);
	flagMessageReceived = 1;

	if (flagAutomatic == 1) globalCommands.push("autolog(\"" + eta_nodeID +", EMCY " + hex(error_code) + " " + addbytes +"\")");
	txtlog(fRED("EMCY Node: " +  eta_nodeID + "  Error: " + hex(error_code) + " " + addbytes +" "));
	if (error_code < 0x1000) {
		var et_num = error_code / 0x100;
		var et_id = et_num + 1;
		if (et_id == 1) {
			txt_logging.append("Debug-EMCY ETA NodeId: " +  eta_nodeID + " "+d3);
		} else {
			txt_logging.append("Debug-EMCY Tube NodeId: " + et_id + " "+d3);
		}
	}

	if (error_code >= 0xF000) {
		var et_num = (error_code & 0x0F00) / 0x100;
		var et_id = et_num + 1;
		lastEmcy[eta_nodeID][et_id] = error_code;
	}

}

// --------------------------------------------------------------------------
// load and initialize UI
// --------------------------------------------------------------------------
function initUI() {
        // load UI file to show dialog
        if (util.loadUIFile("etaetgui.ui","ui") === true) {

            // find buttons and other UI elements for later use
            btn_config = ui.findChild("btnConfig");
			//btn_config.enabled=false;
            btn_connect = ui.findChild("btnConnect");
			//btn_connect.enabled=false;
            btn_disconnect = ui.findChild("btnDisconnect");
			//btn_disconnect.enabled=false;
            btn_assignNodeIds = ui.findChild("btnAssignETA");
            btn_resetClear = ui.findChild("btnResetClear");
            btn_startETA = ui.findChild("btnStartETA");
            btn_readETA = ui.findChild("btnReadETA");
            btn_saveText  = ui.findChild("btnSaveLogging");
            btn_readET = ui.findChild("btnReadET");
            btn_startSync = ui.findChild("btnStartSync");
            btn_stopSync = ui.findChild("btnStopSync");

            btn_EnableSvc = ui.findChild("btnEnableSvc");
            btn_RebootTube = ui.findChild("btnRebootTube");
            btn_ShipModeTube = ui.findChild("btnShipModeTube");
            btn_SvcReadAndClearEvents = ui.findChild("btnSvcReadAndClearEvents")
            cbx_EventType = ui.findChild("cbxEventType")
            tab_svc = ui.findChild("tabSvc")

            btn_attachAllEta = ui.findChild("btnEtaAttachAll");

            spn_eta_nodeid = ui.findChild("spnEtaNodeId");
            spn_et_nodeid = ui.findChild("spnEtNodeId");
            spn_eta_nodeid_2 = ui.findChild("spnEtaNodeId_2");
			spn_et_nodeid_svc = ui.findChild("spnEtNodeId_3");
			spn_eta_nodeid_svc = ui.findChild("spnEtaNodeId_4");

			tblETdata=ui.findChild("tblETdata");
			tblETAdata=ui.findChild("tblETAdata");

            txt_logging = ui.findChild("txtLogging");
			txt_logging.document.maximumBlockCount=maxLines;
            svc_logging = ui.findChild("svcTextEdit");
			svc_logging.document.maximumBlockCount=maxLines;
			
			btn_dumpMemory = ui.findChild("btnSvcDumpMemory");
			cbx_memoryType = ui.findChild("cbxMemoryType");
			cbx_dumpOption = ui.findChild("cbxDumpOption");
			ted_MemoryDumpAddr = ui.findChild("tedSvcMemDumpAddr");
			ted_MemoryDumpLength = ui.findChild("tedSvcMemDumpLength");
			btn_SvcTransitionToNormalState = ui.findChild("btnSvcTransitionToNormalState");
			btn_SvcReadDmc = ui.findChild("btnSvcReadDmc");
			btn_SvcReadSerialNumber = ui.findChild("btnSvcReadSerialNumber");
			btn_SvcChangePassword = ui.findChild("btnSvcChangePassword");
//			ted_SvcNewPassword = ui.findChild("tedSvcNewPassword");
			btn_SvcEtaTransitionToInitColumnState = ui.findChild("btnSvcTransitionToInitColumnState");
			btn_SvcEtaDisableDsh = ui.findChild("btnSvcDisableDshEta");
			btn_SvcEtaDisablePsh = ui.findChild("btnSvcDisablePshEta");
			btn_SvcEtaReadBatteryCellVoltage = ui.findChild("btnSvcReadBatteryCellVoltage");
			ted_SvcPassword = ui.findChild("tedSvcPassword");
			btn_SvcClearProfilingEventList = ui.findChild("btnSvcClearProfilingEventList");
			btn_SvcReadApplication = ui.findChild("btnSvcReadApplication");
			btn_SvcWriteApplication = ui.findChild("btnSvcWriteApplication");
			cbx_ApplicationType = ui.findChild("cbxApplicationType")
			btn_SvcPerformSocEstimation = ui.findChild("btnSvcPerformSocEstimation");
			btn_SvcSetDebugEMCYs = ui.findChild("btnSvcSetDebugEMCYs");
			cbx_DebugEmcyState = ui.findChild("cbxDebugEmcyState")
			btn_SvcWriteDMC = ui.findChild("btnSvcWriteDMC");
			ted_SvcDMC = ui.findChild("tedSvcDMC");
			

            // assign events to buttons ...
            btn_config.clicked.connect(handleCANConfiguration);
            btn_connect.clicked.connect(handleConnect);
            btn_disconnect.clicked.connect(handleDisconnect);

            //btn_assignNodeIds.clicked.connect(assignNodeIDstoETAs);
            btn_assignNodeIds.clicked.connect(handleAssignAll);

            btn_resetClear.clicked.connect(resetAllETA);
            btn_startETA.clicked.connect(startETA);
            btn_readETA.clicked.connect(readDatafromETA);
            btn_saveText.clicked.connect(saveLoggingInText);
            btn_readET.clicked.connect(readDatafromET);
            btn_startSync.clicked.connect(handleStartSync);
            btn_stopSync.clicked.connect(handleStopSync);

            btn_attachAllEta.clicked.connect(attachAllETA);

			btn_EtaAttach = ui.findChild("EtaAttachButton");
			btn_EtaAttach.clicked.connect(EtaAttach);

			btn_EtaDetach = ui.findChild("EtaDetachButton");
			btn_EtaDetach.clicked.connect(EtaDetach);

			ui.findChild("btnPreopETA").clicked.connect(handlePreOpAll);
			ui.findChild("btnResetComm").clicked.connect(handleResetCommAll);
			ui.findChild("btnResetNode").clicked.connect(handleResetApplAll);
			ui.findChild("btnEtaDetachAll").clicked.connect(EtaDetachAll);

			btn_EnableSvc.clicked.connect(svcEnable);
			btn_RebootTube.clicked.connect(svcRebootTube);
			btn_ShipModeTube.clicked.connect(svcShipModeTube);
			btn_SvcReadAndClearEvents.clicked.connect(svcReadAndClearEvents)
			btn_dumpMemory.clicked.connect(svcDumpMemory);
			btn_SvcTransitionToNormalState.clicked.connect(svcTransitionToNormalState);
			btn_SvcReadDmc.clicked.connect(svcReadDmc);
			btn_SvcReadSerialNumber.clicked.connect(svcReadSerialNumber);
			btn_SvcChangePassword.clicked.connect(svcChangePassword);
			btn_SvcEtaTransitionToInitColumnState.clicked.connect(svcEtaTranstionToInitColumnState);
			btn_SvcEtaDisableDsh.clicked.connect(svcEtaDisableDsh);
			btn_SvcEtaDisablePsh.clicked.connect(svcEtaDisablePsh);
			btn_SvcEtaReadBatteryCellVoltage.clicked.connect(svcReadBatteryCellVoltage);
			btn_SvcClearProfilingEventList.clicked.connect(svcClearProfilingEventList);
			
			btn_SvcReadApplication.clicked.connect(svcReadApplication);
			btn_SvcWriteApplication.clicked.connect(svcWriteApplication);
			btn_SvcPerformSocEstimation.clicked.connect(svcPerformSocEstimation);
			btn_SvcSetDebugEMCYs.clicked.connect(svcSetDebugEMCYs);
			btn_SvcWriteDMC.clicked.connect(svcWriteDMC);


			wgtTabWidget=ui.findChild("tabWidget");


			auto_logging = ui.findChild("auto_logging");
			btnAutoDisable = ui.findChild("btnAutoDisable");
			btnAutoEnable = ui.findChild("btnAutoEnable");
			lblAutoEnable = ui.findChild("lblAutoEnable");
			auto_logging.document.maximumBlockCount=maxLines;

			btnAutoDisable.clicked.connect(autoDisable);
			btnAutoEnable.clicked.connect(autoEnable);
			tblAutoState=ui.findChild("autoStateTable");
        } else {
            // file not found
            util.print("Error: Cannot load etaet.ui file");
			return false;
        }

	return true;
}


// --------------------------------------------------------------------------
// register various callback functions for CAN messages
// --------------------------------------------------------------------------
function registerCanCallbacks() {
	util.print("registerCanCallbacks()");
	flagMessageReceived = 1; // ignore check call one time

	// emergencies
	// 0x81 is emsc2
	// 0x82 is the first eta
    for (id = 0x81; id < (0x82 + maxETA); id++) {
        can.registerCanEvent(id, "emcy_callback");
	}

	can.registerCanEvent(0x701, "emsc2Callback");

    // to be called after reception of HB messages
    for (id = 0x702; id < (0x702 + maxETA); id++) {
        can.registerCanEvent(id, "hbCallback");
    }

    // reception of PDO 1 from ETA 1 ..12
    for (id = 0x192; id < (0x192 + maxETA); id++) {
        can.registerCanEvent(id, "pdoMSN1_callback");
    }

    // reception of PDO 2 from ETA 1 ..12
    for (id = 0x292; id < (0x292 + maxETA); id++) {
        can.registerCanEvent(id, "pdoMSN2_callback");
    }

    // reception of PDO 3 from ETA 1 ..12
    for (id = 0x392; id < (0x392 + maxETA); id++) {
        can.registerCanEvent(id, "pdoMSN3_callback");
    }

    // reception of PDO d from ETA 1 ..12
    for (id = 0x492; id < (0x492 + maxETA); id++) {
        can.registerCanEvent(id, "pdod_callback");
    }
}

//-------------------------------------------------------------------
//reset all events
function stopCallbacks()
{
	util.print("Reset all Events, Sync, Timer");
	util.stopSync(); //stop sync
	util.deleteAllTimers();	
	can.unregisterAllCanEvents();	

	return true;
}

//-------------------------------------------------------------------
function checkLife()
{
	if (canconnection.isConnected() == true) {
		if (flagMessageReceived == 0) {
			globalCommands.push("registerCanCallbacks();");
			flagMessageReceived = 1; // ignore call one time
			return
		}
	}
	flagMessageReceived = 0;
}

//-------------------------------------------------------------------


// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
//
// start of script ..
// --------------------------------------------------------------------------
if (initUI() == true) {
	registerCanCallbacks();
	util.every(60000, "checkLife();");

	// config start tab 
	wgtTabWidget.setCurrentIndex(0);

	// open logging file
	//fileHandle.open( 2 | 8 ) // write and truncate

	txt_logging.append("Please update to CDE 2.7.1.3 \n");
	txt_logging.append("CDE 2.6.2 - SDO timeout for Scripting is 1.5s (ca. 5 Tubes possible)");
	txt_logging.append("Disable the SDO Routing Button as long as you use this Script!\n");

	txt_logging.append("Column Control:");
	txt_logging.append("Press 'Assign Node-Id to all ETA' to initialize the script");
	txt_logging.append("Press 'NMT: Operational all ETA' to start the network\n");

	txt_logging.append("Service Interface:");
	txt_logging.append("ET NodeID 1 means ETA itself.\n");
	txt_logging.append("--------------------------------------------------\n");

	// --------------------------------------------------------------------------
	while (ui.visible) {
		if (canconnection.isConnected() === false) {
			pause(1000);
		} else {
			pause(10);
		}
		while (globalCommands.length > 0) {
		//if (globalCommands.length > 0) {
			if (debugflag != 0) util.print(globalCommands[0] + " -- " + globalCommands.length );
			eval(globalCommands[0]);
			globalCommands.shift();	
		} 
	}

	util.print("while loop end\n");
	stopCallbacks();
}
// --------------------------------------------------------------------------
