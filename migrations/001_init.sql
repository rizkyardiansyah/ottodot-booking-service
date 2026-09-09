CREATE TABLE students (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_name  text NOT NULL,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE classes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  starts_at    timestamptz NOT NULL,
  capacity     int  NOT NULL DEFAULT 4,
  status       text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid NOT NULL REFERENCES classes(id),
  student_id   uuid NOT NULL REFERENCES students(id),
  status       text NOT NULL
    CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bookings_active_unique
  ON bookings (class_id, student_id)
  WHERE status IN ('PENDING_PAYMENT', 'CONFIRMED');

CREATE INDEX bookings_class_status_idx ON bookings (class_id, status);

CREATE TABLE payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL UNIQUE REFERENCES bookings(id),
  amount       numeric(10,2) NOT NULL DEFAULT 0,
  status       text NOT NULL
    CHECK (status IN ('PENDING', 'SETTLED', 'FAILED', 'REFUNDED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
