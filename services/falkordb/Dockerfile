FROM falkordb/falkordb:6.0.2@sha256:107455e862a824e45e8e9f5a7fbfdf5e00a08b14e13eae2577c72fd9e3f59ba6

USER root
RUN mkdir -p /etc/brainee
COPY infra/falkordb/redis.conf /etc/brainee/redis.conf
COPY services/falkordb/entrypoint.sh /usr/local/bin/brainee-falkordb-entrypoint
RUN chmod 0755 /usr/local/bin/brainee-falkordb-entrypoint

ENV REDIS_ARGS=/etc/brainee/redis.conf
ENTRYPOINT ["/usr/local/bin/brainee-falkordb-entrypoint"]
