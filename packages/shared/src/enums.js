'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PaymentStatus =
  exports.GoodSize =
  exports.ZoneType =
  exports.AlertType =
  exports.TransferStatus =
  exports.ReservationStatus =
  exports.ClientType =
  exports.UserRole =
    void 0;
var UserRole;
(function (UserRole) {
  UserRole['CLIENT_PARTICULAR'] = 'CLIENT_PARTICULAR';
  UserRole['CLIENT_EMPRESA'] = 'CLIENT_EMPRESA';
  UserRole['OPERATOR'] = 'OPERATOR';
  UserRole['ADMIN'] = 'ADMIN';
  UserRole['CONDUCTOR'] = 'CONDUCTOR';
})(UserRole || (exports.UserRole = UserRole = {}));
var ClientType;
(function (ClientType) {
  ClientType['PARTICULAR'] = 'PARTICULAR';
  ClientType['EMPRESA'] = 'EMPRESA';
})(ClientType || (exports.ClientType = ClientType = {}));
var ReservationStatus;
(function (ReservationStatus) {
  ReservationStatus['PENDING_CLASSIFICATION'] = 'PENDING_CLASSIFICATION';
  ReservationStatus['PENDING_QUOTE'] = 'PENDING_QUOTE';
  ReservationStatus['QUOTED'] = 'QUOTED';
  ReservationStatus['PENDING_PAYMENT'] = 'PENDING_PAYMENT';
  ReservationStatus['CONFIRMED'] = 'CONFIRMED';
  ReservationStatus['REJECTED'] = 'REJECTED';
  ReservationStatus['ACCEPTED'] = 'ACCEPTED';
  ReservationStatus['CANCELLED'] = 'CANCELLED';
})(ReservationStatus || (exports.ReservationStatus = ReservationStatus = {}));
var TransferStatus;
(function (TransferStatus) {
  TransferStatus['PENDING'] = 'PENDING';
  TransferStatus['IN_TRANSIT'] = 'IN_TRANSIT';
  TransferStatus['COMPLETED'] = 'COMPLETED';
  TransferStatus['CANCELLED'] = 'CANCELLED';
})(TransferStatus || (exports.TransferStatus = TransferStatus = {}));
var AlertType;
(function (AlertType) {
  AlertType['ZONE_RED_ENTRY'] = 'ZONE_RED_ENTRY';
  AlertType['ZONE_PREFERRED_ENTRY'] = 'ZONE_PREFERRED_ENTRY';
  AlertType['STOP_DETECTED'] = 'STOP_DETECTED';
  AlertType['EXCESSIVE_SPEED'] = 'EXCESSIVE_SPEED';
  AlertType['ROUTE_DEVIATION'] = 'ROUTE_DEVIATION';
})(AlertType || (exports.AlertType = AlertType = {}));
var ZoneType;
(function (ZoneType) {
  ZoneType['RED'] = 'RED';
  ZoneType['PREFERRED'] = 'PREFERRED';
})(ZoneType || (exports.ZoneType = ZoneType = {}));
var GoodSize;
(function (GoodSize) {
  GoodSize['SMALL'] = 'SMALL';
  GoodSize['MEDIUM'] = 'MEDIUM';
  GoodSize['LARGE'] = 'LARGE';
  GoodSize['EXTRA_LARGE'] = 'EXTRA_LARGE';
})(GoodSize || (exports.GoodSize = GoodSize = {}));
var PaymentStatus;
(function (PaymentStatus) {
  PaymentStatus['PENDING'] = 'PENDING';
  PaymentStatus['APPROVED'] = 'APPROVED';
  PaymentStatus['REJECTED'] = 'REJECTED';
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
//# sourceMappingURL=enums.js.map
